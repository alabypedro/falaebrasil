ALTER TABLE public.customer_relationships DROP CONSTRAINT IF EXISTS customer_relationships_stage_check;
ALTER TABLE public.customer_relationships ADD CONSTRAINT customer_relationships_stage_check CHECK (stage IN ('novo_cliente','em_uso','engajado','oportunidade_guia','oportunidade_treino','oportunidade_pro','cliente_pro','sem_interesse','reativacao_futura'));
ALTER TABLE public.customer_relationships
  ADD COLUMN IF NOT EXISTS next_contact_type text CHECK (next_contact_type IS NULL OR next_contact_type IN ('automatico','humano')),
  ADD COLUMN IF NOT EXISTS next_offer_suggested_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_offer_responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS engagement_level text;

ALTER TABLE public.customer_relationship_history DROP CONSTRAINT IF EXISTS customer_relationship_history_type_check;
ALTER TABLE public.customer_relationship_history ADD CONSTRAINT customer_relationship_history_type_check CHECK (type IN ('compra','acesso_produto','email_automatico','email_manual','whatsapp','ligacao','resposta_cliente','pedido_ajuda','interesse','oferta_enviada','venda','tarefa_criada','tarefa_concluida','observacao_interna','mudanca_etapa'));
ALTER TABLE public.customer_relationship_history ADD COLUMN IF NOT EXISTS result text;

CREATE OR REPLACE FUNCTION public.log_relationship_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.customer_relationship_history (user_id, type, responsible_id, notes, created_by)
    VALUES (NEW.user_id, 'mudanca_etapa', NEW.responsible_id, OLD.stage || ' → ' || NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.relationship_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  source text NOT NULL DEFAULT 'automatico' CHECK (source IN ('automatico','manual')),
  reason text NOT NULL,
  responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','adiada','cancelada')),
  dedupe_key text UNIQUE,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relationship_tasks_open_idx ON public.relationship_tasks(status, due_at);
CREATE INDEX relationship_tasks_user_idx ON public.relationship_tasks(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_tasks TO authenticated;
GRANT ALL ON public.relationship_tasks TO service_role;
ALTER TABLE public.relationship_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage relationship tasks" ON public.relationship_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.relationship_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  day_offset integer NOT NULL,
  interaction_type text NOT NULL DEFAULT 'automatico' CHECK (interaction_type IN ('automatico','humano')),
  product_key text,
  stage text,
  next_offer text,
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_message_templates TO authenticated;
GRANT ALL ON public.relationship_message_templates TO service_role;
ALTER TABLE public.relationship_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage relationship templates" ON public.relationship_message_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.generate_relationship_tasks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _medium int; _high int; _recent int; _resp uuid; _created int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT coalesce((value->>'medium')::int, 300), coalesce((value->>'high')::int, 1500), coalesce((value->>'recent_events')::int, 5)
    INTO _medium, _high, _recent FROM public.relationship_settings WHERE key = 'engagement';
  _medium := coalesce(_medium, 300); _high := coalesce(_high, 1500); _recent := coalesce(_recent, 5);
  SELECT nullif(value->>'user_id','')::uuid INTO _resp FROM public.relationship_settings WHERE key = 'default_responsible';

  WITH paid AS (
    SELECT ap.user_id, coalesce(ap.paid_at, ap.created_at) AS at, ap.product_key,
      coalesce((SELECT array_agg(ip.product_key) FROM public.payment_products pp
        JOIN public.payment_product_bundles b ON b.product_id = pp.id
        JOIN public.payment_products ip ON ip.id = b.included_product_id
        WHERE pp.product_key = ap.product_key), ARRAY[]::text[]) AS included
    FROM public.asaas_payments ap
    WHERE ap.user_id IS NOT NULL AND upper(ap.status) IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')
  ),
  base AS (
    SELECT p.user_id, max(p.at) AS last_at,
      (SELECT count(DISTINCT k) FROM paid p2, unnest(array_append(p2.included, p2.product_key)) k
        WHERE p2.user_id = p.user_id AND k LIKE 'bst%') AS guides
    FROM paid p GROUP BY p.user_id
  ),
  sig AS (
    SELECT b.user_id, b.last_at, b.guides,
      floor(extract(epoch FROM now() - b.last_at) / 86400)::int AS days,
      coalesce(pr.xp,0) + coalesce((SELECT sum(points) FROM public.ai_xp_events e WHERE e.user_id = b.user_id),0) AS xp,
      (SELECT count(*) FROM public.ai_xp_events e WHERE e.user_id = b.user_id AND e.created_at > now() - interval '7 days') AS recent,
      (SELECT h.id FROM public.customer_relationship_history h WHERE h.user_id = b.user_id AND h.type = 'resposta_cliente' AND h.created_at > now() - interval '14 days' ORDER BY h.created_at DESC LIMIT 1) AS reply_id,
      (SELECT h.id FROM public.customer_relationship_history h WHERE h.user_id = b.user_id AND h.type IN ('pedido_ajuda','interesse') AND h.created_at > now() - interval '14 days' ORDER BY h.created_at DESC LIMIT 1) AS interest_id,
      coalesce(cr.manual_attention, false) AS manual,
      coalesce(cr.responsible_id, _resp) AS resp,
      coalesce(cr.stage, 'novo_cliente') AS stage
    FROM base b JOIN public.profiles pr ON pr.user_id = b.user_id
    LEFT JOIN public.customer_relationships cr ON cr.user_id = b.user_id
  ),
  cand AS (
    SELECT user_id, resp, 'resposta' AS t, 'Cliente respondeu mensagem' AS reason, 'alta' AS pr, user_id || ':resposta:' || reply_id AS k FROM sig WHERE reply_id IS NOT NULL
    UNION ALL SELECT user_id, resp, 'interesse', 'Pediu ajuda ou demonstrou interesse', 'alta', user_id || ':interesse:' || interest_id FROM sig WHERE interest_id IS NOT NULL
    UNION ALL SELECT user_id, resp, 'manual', 'Marcado manualmente para atenção', 'alta', user_id || ':manual:' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMMDD') FROM sig WHERE manual
    UNION ALL SELECT user_id, resp, 'xp_alto', 'XP alto', 'alta', user_id || ':xp_alto:' || to_char(last_at,'YYYYMMDD') FROM sig WHERE xp >= _high AND days <= 60 AND stage NOT IN ('sem_interesse','cliente_pro')
    UNION ALL SELECT user_id, resp, 'multi_guia', 'Comprou mais de um Guia', 'alta', user_id || ':multi_guia:' || to_char(last_at,'YYYYMMDD') FROM sig WHERE guides > 1 AND days <= 60 AND stage NOT IN ('sem_interesse','cliente_pro')
    UNION ALL SELECT user_id, resp, 'uso_recente', 'Muitos acessos recentes', 'alta', user_id || ':uso_recente:' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','IYYYIW') FROM sig WHERE recent >= _recent AND stage NOT IN ('sem_interesse')
    UNION ALL SELECT user_id, resp, 'd7', 'D+7 com engajamento', 'normal', user_id || ':d7:' || to_char(last_at,'YYYYMMDD') FROM sig WHERE days BETWEEN 7 AND 13 AND (xp >= _medium OR recent >= _recent OR reply_id IS NOT NULL) AND stage NOT IN ('sem_interesse')
    UNION ALL SELECT user_id, resp, 'd14', 'D+14 com engajamento — avaliar próxima oferta', 'normal', user_id || ':d14:' || to_char(last_at,'YYYYMMDD') FROM sig WHERE days BETWEEN 14 AND 29 AND (xp >= _medium OR recent >= _recent OR reply_id IS NOT NULL) AND stage NOT IN ('sem_interesse')
    UNION ALL SELECT user_id, resp, 'd30', 'D+30 com alto engajamento', 'normal', user_id || ':d30:' || to_char(last_at,'YYYYMMDD') FROM sig WHERE days BETWEEN 30 AND 59 AND xp >= _high AND stage NOT IN ('sem_interesse')
  ),
  ins AS (
    INSERT INTO public.relationship_tasks (user_id, task_type, source, reason, responsible_id, priority, dedupe_key, due_at)
    SELECT user_id, t, 'automatico', reason, resp, pr, k, now() FROM cand
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING user_id, reason, responsible_id
  ),
  hist AS (
    INSERT INTO public.customer_relationship_history (user_id, type, responsible_id, notes)
    SELECT user_id, 'tarefa_criada', responsible_id, reason FROM ins
    RETURNING 1
  )
  SELECT count(*) INTO _created FROM hist;
  RETURN _created;
END $$;
REVOKE ALL ON FUNCTION public.generate_relationship_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_relationship_tasks() TO authenticated;

CREATE OR REPLACE FUNCTION public.relationship_alert_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.has_role(auth.uid(), 'admin') THEN (
    SELECT count(*)::int FROM public.relationship_tasks
    WHERE status IN ('pendente','adiada')
      AND due_at < ((date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo')
  ) ELSE 0 END
$$;
REVOKE ALL ON FUNCTION public.relationship_alert_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relationship_alert_count() TO authenticated;