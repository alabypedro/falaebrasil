-- 1) Assinatura em dia?
CREATE OR REPLACE FUNCTION public.subscription_is_current(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _grace timestamptz;
BEGIN
  SELECT lower(coalesce(subscription_status, '')), subscription_grace_until
    INTO _status, _grace
  FROM public.profiles WHERE user_id = _user_id;

  IF _status IS NULL THEN RETURN false; END IF;
  IF _status IN ('', 'none', 'active', 'trialing', 'authorized') THEN RETURN true; END IF;
  IF _grace IS NOT NULL AND _grace > now() THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- 2) Categoria OPEN "crua" (sem checar assinatura)
CREATE OR REPLACE FUNCTION public.has_open_category_raw(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_categories sc
    JOIN public.student_category_defs d ON d.code = sc.code
    WHERE sc.user_id = _user_id AND d.kind = 'open'
  )
$$;

-- 3) OPEN efetivo = categoria OPEN + assinatura em dia
CREATE OR REPLACE FUNCTION public.has_open_category(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_open_category_raw(_user_id)
     AND public.subscription_is_current(_user_id)
$$;

-- 4) Cursos: OPEN libera tudo; inadimplente perde tudo
CREATE OR REPLACE FUNCTION public.has_course_access(_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
            AND public.tier_rank(p.plan_tier) >= public.tier_rank(c.required_tier)
        )
      )
    )
$$;

-- 5) Produtos BST: OPEN em dia vê todos (inclusive novos); BST puro mantém o que comprou
CREATE OR REPLACE FUNCTION public.has_bst_product_access(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_open_category(auth.uid())
    OR (
      NOT public.has_open_category_raw(auth.uid())
      AND (
        EXISTS (
          SELECT 1 FROM public.bst_product_access a
          WHERE a.user_id = auth.uid() AND a.product_id = _product_id
        )
        OR (
          public.subscription_is_current(auth.uid())
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid() AND p.has_course_access = true
          )
        )
      )
    )
$$;

-- 6) Itens legados da biblioteca
CREATE OR REPLACE FUNCTION public.has_bst_item_access(_access_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 7) Aplicar categoria OPEN libera TUDO (sem duplicar cadastro)
CREATE OR REPLACE FUNCTION public.apply_student_category(_user_id uuid, _code text, _source text DEFAULT 'asaas'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _kind text;
BEGIN
  IF _code IS NULL THEN RETURN; END IF;
  SELECT kind INTO _kind FROM public.student_category_defs WHERE code = _code;
  IF _kind IS NULL THEN RETURN; END IF;

  INSERT INTO public.student_categories (user_id, code, source)
  VALUES (_user_id, _code, _source)
  ON CONFLICT (user_id, code) DO NOTHING;

  IF _kind = 'open' THEN
    -- OPEN não coexiste com categorias BST
    DELETE FROM public.student_categories sc
    USING public.student_category_defs d
    WHERE sc.code = d.code AND sc.user_id = _user_id AND d.kind = 'bst';

    -- Libera todos os cursos existentes
    INSERT INTO public.user_course_access (user_id, course_id, source)
    SELECT _user_id, c.id, _source FROM public.courses c
    ON CONFLICT DO NOTHING;

    PERFORM set_config('app.bypass_profile_protection', 'on', true);
    UPDATE public.profiles
    SET has_course_access = true,
        plan_tier = CASE
          WHEN lower(coalesce(plan_tier, '')) IN ('pro', 'vip', 'kids', 'teens') THEN plan_tier
          ELSE 'open'
        END,
        updated_at = now()
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- 8) Liberação instantânea após pagamento: limpar tolerância
CREATE OR REPLACE FUNCTION public.grant_access_from_asaas(_user_id uuid, _asaas_payment_id text, _product_key text, _raw jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prod public.payment_products;
  _already boolean;
  _result jsonb;
  _bundle_ids uuid[];
  _all_ids uuid[];
  _bst_count int := 0;
  _any_course boolean := false;
  _cat text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _prod
  FROM public.payment_products
  WHERE product_key = _product_key AND active = true;

  IF _prod.id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_product');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.asaas_payments
    WHERE asaas_payment_id = _asaas_payment_id AND access_granted_at IS NOT NULL
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('granted', true, 'product_key', _product_key, 'already_processed', true);
  END IF;

  SELECT COALESCE(array_agg(included_product_id), ARRAY[]::uuid[]) INTO _bundle_ids
  FROM public.payment_product_bundles WHERE product_id = _prod.id;

  _all_ids := ARRAY[_prod.id] || _bundle_ids;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);

  UPDATE public.profiles p SET
    has_course_access = CASE WHEN agg.any_course THEN true ELSE has_course_access END,
    has_ebook1_access = CASE WHEN agg.any_ebook1 THEN true ELSE has_ebook1_access END,
    has_ebook2_access = CASE WHEN agg.any_ebook2 THEN true ELSE has_ebook2_access END,
    has_ebook3_access = CASE WHEN agg.any_ebook3 THEN true ELSE has_ebook3_access END,
    scripted_balance = scripted_balance + agg.total_scripted,
    unscripted_balance = unscripted_balance + agg.total_unscripted,
    plan_tier = COALESCE(_prod.plan_tier, plan_tier),
    subscription_status = CASE WHEN _prod.type = 'subscription' THEN 'active' ELSE subscription_status END,
    subscription_grace_until = CASE WHEN _prod.type = 'subscription' THEN NULL ELSE subscription_grace_until END,
    updated_at = now()
  FROM (
    SELECT
      bool_or(grants_course_access) AS any_course,
      bool_or(grants_ebook1_access) AS any_ebook1,
      bool_or(grants_ebook2_access) AS any_ebook2,
      bool_or(grants_ebook3_access) AS any_ebook3,
      COALESCE(SUM(grants_scripted_seconds), 0)::int AS total_scripted,
      COALESCE(SUM(grants_unscripted_seconds), 0)::int AS total_unscripted
    FROM public.payment_products
    WHERE id = ANY(_all_ids)
  ) agg
  WHERE p.user_id = _user_id;

  INSERT INTO public.user_course_access (user_id, course_id, source)
  SELECT _user_id, ppc.course_id, 'asaas'
  FROM public.payment_product_courses ppc
  WHERE ppc.product_id = ANY(_all_ids)
  ON CONFLICT DO NOTHING;

  WITH ins AS (
    INSERT INTO public.bst_product_access (user_id, product_id, source)
    SELECT DISTINCT _user_id, pp.grants_bst_product_id, 'asaas'
    FROM public.payment_products pp
    WHERE pp.id = ANY(_all_ids) AND pp.grants_bst_product_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _bst_count FROM ins;

  SELECT COALESCE(bool_or(grants_course_access), false) INTO _any_course
  FROM public.payment_products WHERE id = ANY(_all_ids);

  FOR _cat IN
    SELECT DISTINCT pp.grants_category
    FROM public.payment_products pp
    WHERE pp.id = ANY(_all_ids) AND pp.grants_category IS NOT NULL
    ORDER BY pp.grants_category
  LOOP
    PERFORM public.apply_student_category(_user_id, _cat, 'asaas');
  END LOOP;

  IF NOT _any_course AND _prod.plan_tier IS NULL
     AND EXISTS (SELECT 1 FROM public.payment_products WHERE id = ANY(_all_ids) AND grants_bst_product_id IS NOT NULL) THEN
    UPDATE public.profiles p
    SET plan_tier = 'bst', updated_at = now()
    WHERE p.user_id = _user_id
      AND COALESCE(p.has_course_access, false) = false
      AND lower(COALESCE(p.plan_tier, '')) NOT IN ('pro','vip','kids','teens')
      AND NOT public.has_open_category_raw(_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_course_access uca WHERE uca.user_id = _user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.asaas_subscriptions s
        WHERE s.user_id = _user_id AND lower(s.status) IN ('active','overdue')
      );
  END IF;

  _result := jsonb_build_object(
    'granted', true,
    'product_key', _product_key,
    'bundle_items', array_length(_bundle_ids, 1),
    'bst_granted', _bst_count,
    'already_processed', false
  );

  UPDATE public.asaas_payments
  SET product_key = _product_key,
      access_granted_at = now(),
      access_grant_result = _result,
      updated_at = now()
  WHERE asaas_payment_id = _asaas_payment_id;

  RETURN _result;
END;
$function$;