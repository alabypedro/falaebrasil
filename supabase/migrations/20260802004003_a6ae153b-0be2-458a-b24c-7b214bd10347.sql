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

  -- Categorias de aluno (OPEN / BST1 / BST2 ...): aplica as de todos os itens.
  FOR _cat IN
    SELECT DISTINCT pp.grants_category
    FROM public.payment_products pp
    WHERE pp.id = ANY(_all_ids) AND pp.grants_category IS NOT NULL
    ORDER BY pp.grants_category
  LOOP
    PERFORM public.apply_student_category(_user_id, _cat, 'asaas');
  END LOOP;

  -- BST-only buyer -> restricted tier.
  IF NOT _any_course AND _prod.plan_tier IS NULL
     AND EXISTS (SELECT 1 FROM public.payment_products WHERE id = ANY(_all_ids) AND grants_bst_product_id IS NOT NULL) THEN
    UPDATE public.profiles p
    SET plan_tier = 'bst', updated_at = now()
    WHERE p.user_id = _user_id
      AND COALESCE(p.has_course_access, false) = false
      AND lower(COALESCE(p.plan_tier, '')) NOT IN ('pro','vip','kids','teens')
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