-- Experiência PRO de R$5: 30 dias de acesso, por público (Adultos x Kids/Teens)

CREATE TABLE public.experience_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  segment text NOT NULL CHECK (segment IN ('adults','kids_teens')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  asaas_payment_id text NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT experience_access_one_per_user UNIQUE (user_id)
);

GRANT SELECT ON public.experience_access TO authenticated;
GRANT ALL ON public.experience_access TO service_role;

ALTER TABLE public.experience_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own experience" ON public.experience_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all experiences" ON public.experience_access
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.experience_access;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.experience_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Concede a experiência (idempotente: uma única vez por aluno)
CREATE OR REPLACE FUNCTION public.grant_experience_access(_user_id uuid, _segment text, _asaas_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _row public.experience_access;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _user_id IS NULL OR _segment NOT IN ('adults','kids_teens') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid_input');
  END IF;

  SELECT * INTO _row FROM public.experience_access WHERE user_id = _user_id;
  IF _row.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'already_used',
      'segment', _row.segment,
      'expires_at', _row.expires_at,
      'original_payment_id', _row.asaas_payment_id
    );
  END IF;

  INSERT INTO public.experience_access (user_id, segment, started_at, expires_at, asaas_payment_id)
  VALUES (_user_id, _segment, now(), now() + interval '30 days', _asaas_payment_id)
  RETURNING * INTO _row;

  RETURN jsonb_build_object(
    'granted', true,
    'segment', _row.segment,
    'started_at', _row.started_at,
    'expires_at', _row.expires_at
  );
END
$function$;

-- Estado da experiência para o app (mostra vencimento e público)
CREATE OR REPLACE FUNCTION public.get_experience_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(
    (SELECT jsonb_build_object(
       'active', true,
       'segment', e.segment,
       'started_at', e.started_at,
       'expires_at', e.expires_at,
       'days_left', greatest(0, ceil(extract(epoch FROM (e.expires_at - now())) / 86400))::int
     )
     FROM public.experience_access e
     WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.expires_at > now()
     LIMIT 1),
    jsonb_build_object('active', false)
  );
$function$;

-- Auxiliares de autorização
CREATE OR REPLACE FUNCTION public.experience_is_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.experience_access e
    WHERE e.user_id = _user_id AND e.status = 'active' AND e.expires_at > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.experience_allows_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.experience_access e
    JOIN public.courses c ON c.id = _course_id
    WHERE e.user_id = _user_id
      AND e.status = 'active'
      AND e.expires_at > now()
      AND (
        (e.segment = 'adults' AND lower(coalesce(c.required_tier,'open')) NOT IN ('kids','teens'))
        OR (e.segment = 'kids_teens' AND lower(c.required_tier) IN ('kids','teens'))
      )
  );
$function$;

-- Permissões das funções
REVOKE EXECUTE ON FUNCTION public.grant_experience_access(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_experience_access(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_experience_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.experience_is_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.experience_allows_course(uuid, uuid) TO authenticated, service_role;

-- Cursos: experiência libera apenas o público correto
CREATE OR REPLACE FUNCTION public.has_course_access(_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.subscription_is_current(auth.uid())
      AND (
        public.has_open_category_raw(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_course_access
          WHERE user_id = auth.uid() AND course_id = _course_id
        )
        OR EXISTS (
          SELECT 1 FROM public.courses c
          JOIN public.profiles p ON p.user_id = auth.uid()
          WHERE c.id = _course_id
            AND p.has_course_access = true
            AND public.tier_satisfies(p.plan_tier, c.required_tier)
        )
      )
    )
    OR public.experience_allows_course(auth.uid(), _course_id)
$function$;

-- BST: experiência ativa libera todos os produtos enquanto dura
CREATE OR REPLACE FUNCTION public.has_bst_product_access(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_open_category(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.bst_product_access a
      WHERE a.user_id = auth.uid()
        AND a.product_id = _product_id
    )
    OR public.experience_is_active(auth.uid())
$function$;

-- Bibliotecaê: experiência ativa libera os itens
CREATE OR REPLACE FUNCTION public.has_bst_item_access(_access_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR _access_key = 'free'
    OR public.has_open_category(auth.uid())
    OR (
      public.subscription_is_current(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND (
            (_access_key = 'ebook1' AND p.has_ebook1_access = true)
            OR (_access_key = 'ebook2' AND p.has_ebook2_access = true)
            OR (_access_key = 'ebook3' AND p.has_ebook3_access = true)
          )
      )
    )
    OR public.experience_is_active(auth.uid())
$function$;

-- Cadastro das duas experiências (links ASAAS já criados)
INSERT INTO public.payment_products
  (product_key, name, description, type, price_cents, billing_cycle, active, checkout_url, display_order)
VALUES
  ('experiencia_pro_adultos',
   'Experiência PRO 30 dias — Adultos',
   '30 dias de acesso ao aplicativo e às aulas ao vivo via Zoom, para adultos. Courses Kids e Teens ficam bloqueados.',
   'one_time', 500, NULL, true,
   'https://www.asaas.com/000/c/4d3sc7g8rky3eh40', 900),
  ('experiencia_pro_kids_teens',
   'Experiência PRO 30 dias — Kids e Teens',
   '30 dias de acesso ao aplicativo e às aulas ao vivo via Zoom, para crianças e adolescentes. Courses de adultos ficam bloqueados.',
   'one_time', 500, NULL, true,
   'https://www.asaas.com/000/c/ghhwvyupo5eqiqyr', 901)
ON CONFLICT (product_key) DO NOTHING;