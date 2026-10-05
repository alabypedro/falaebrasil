CREATE TABLE public.customer_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'novo_cliente' CHECK (stage IN ('novo_cliente','em_uso','engajado','oportunidade_guia','oportunidade_treino','oportunidade_pro','cliente_pro','sem_interesse')),
  responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  preferred_channel text CHECK (preferred_channel IS NULL OR preferred_channel IN ('whatsapp','email','ligacao','app')),
  next_offer text NOT NULL DEFAULT 'nenhuma' CHECK (next_offer IN ('nenhuma','outro_guia','treino_express','plano_pro')),
  next_offer_notes text,
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_relationships TO authenticated;
GRANT ALL ON public.customer_relationships TO service_role;
ALTER TABLE public.customer_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customer relationships" ON public.customer_relationships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.customer_relationship_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('compra','email_automatico','email_manual','whatsapp','ligacao','resposta_cliente','oferta_enviada','venda','observacao_interna')),
  channel text,
  responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_relationship_history_user_idx ON public.customer_relationship_history(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_relationship_history TO authenticated;
GRANT ALL ON public.customer_relationship_history TO service_role;
ALTER TABLE public.customer_relationship_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage relationship history" ON public.customer_relationship_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.relationship_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_settings TO authenticated;
GRANT ALL ON public.relationship_settings TO service_role;
ALTER TABLE public.relationship_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage relationship settings" ON public.relationship_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_relationship_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.customer_relationship_history (user_id, type, responsible_id, notes, created_by)
    VALUES (NEW.user_id, 'observacao_interna', NEW.responsible_id, 'Etapa alterada: ' || OLD.stage || ' → ' || NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_relationships_stage_log BEFORE UPDATE ON public.customer_relationships
  FOR EACH ROW EXECUTE FUNCTION public.log_relationship_stage_change();

CREATE OR REPLACE FUNCTION public.get_relationship_customers()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH buyers AS (
    SELECT user_id FROM public.asaas_payments
      WHERE user_id IS NOT NULL AND upper(status) IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')
    UNION
    SELECT user_id FROM public.asaas_subscriptions WHERE user_id IS NOT NULL
  ),
  purchases AS (
    SELECT ap.user_id,
      jsonb_agg(jsonb_build_object(
        'product_key', ap.product_key,
        'name', coalesce(pp.name, ap.product_key, 'Produto'),
        'included', coalesce((SELECT jsonb_agg(ip.name) FROM public.payment_product_bundles b
            JOIN public.payment_products ip ON ip.id = b.included_product_id WHERE b.product_id = pp.id), '[]'::jsonb),
        'included_keys', coalesce((SELECT jsonb_agg(ip.product_key) FROM public.payment_product_bundles b
            JOIN public.payment_products ip ON ip.id = b.included_product_id WHERE b.product_id = pp.id), '[]'::jsonb),
        'paid_at', coalesce(ap.paid_at, ap.created_at),
        'value_cents', ap.value_cents,
        'status', ap.status) ORDER BY coalesce(ap.paid_at, ap.created_at) DESC) AS items,
      max(coalesce(ap.paid_at, ap.created_at)) AS last_purchase_at
    FROM public.asaas_payments ap
    LEFT JOIN public.payment_products pp ON pp.product_key = ap.product_key
    WHERE ap.user_id IS NOT NULL AND upper(ap.status) IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')
    GROUP BY ap.user_id
  ),
  subs AS (
    SELECT s.user_id, jsonb_agg(jsonb_build_object('product_key', s.product_key,
      'name', coalesce(pp.name, s.product_key), 'status', s.status, 'created_at', s.created_at)) AS items
    FROM public.asaas_subscriptions s LEFT JOIN public.payment_products pp ON pp.product_key = s.product_key
    WHERE s.user_id IS NOT NULL GROUP BY s.user_id
  ),
  aixp AS (
    SELECT user_id, sum(points)::int AS xp,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS recent
    FROM public.ai_xp_events GROUP BY user_id
  )
  SELECT jsonb_build_object(
    'customers', coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.user_id,
      'name', p.display_name,
      'email', p.email,
      'phone', coalesce(ac.phone, p.phone),
      'plan_tier', p.plan_tier,
      'created_at', p.created_at,
      'last_activity', p.last_activity,
      'xp', coalesce(p.xp,0) + coalesce(ax.xp,0),
      'recent_events', coalesce(ax.recent,0),
      'bst_products', (SELECT count(*) FROM public.bst_product_access a WHERE a.user_id = p.user_id),
      'course_access', (SELECT count(*) FROM public.user_course_access a WHERE a.user_id = p.user_id),
      'categories', coalesce((SELECT jsonb_agg(c.code) FROM public.student_categories c WHERE c.user_id = p.user_id), '[]'::jsonb),
      'purchases', coalesce(pu.items, '[]'::jsonb),
      'subscriptions', coalesce(su.items, '[]'::jsonb),
      'last_purchase_at', coalesce(pu.last_purchase_at, (SELECT max(created_at) FROM public.asaas_subscriptions s WHERE s.user_id = p.user_id)),
      'has_reply', EXISTS (SELECT 1 FROM public.customer_relationship_history h WHERE h.user_id = p.user_id AND h.type = 'resposta_cliente'),
      'relationship', to_jsonb(cr)
    )), '[]'::jsonb),
    'admins', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', r.user_id,
        'name', coalesce(nullif(pr.display_name,''), pr.email, 'Admin')) ORDER BY pr.display_name)
      FROM public.user_roles r LEFT JOIN public.profiles pr ON pr.user_id = r.user_id WHERE r.role = 'admin'), '[]'::jsonb)
  ) INTO _result
  FROM buyers b
  JOIN public.profiles p ON p.user_id = b.user_id
  LEFT JOIN LATERAL (SELECT phone FROM public.asaas_customers c WHERE c.user_id = p.user_id LIMIT 1) ac ON true
  LEFT JOIN purchases pu ON pu.user_id = p.user_id
  LEFT JOIN subs su ON su.user_id = p.user_id
  LEFT JOIN aixp ax ON ax.user_id = p.user_id
  LEFT JOIN public.customer_relationships cr ON cr.user_id = p.user_id;

  RETURN _result;
END $$;
REVOKE ALL ON FUNCTION public.get_relationship_customers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_relationship_customers() TO authenticated;