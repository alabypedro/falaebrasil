CREATE TABLE public.asaas_access_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_payment_id text NOT NULL,
  asaas_subscription_id text,
  payment_product_id uuid NOT NULL REFERENCES public.payment_products(id) ON DELETE RESTRICT,
  entitlement_type text NOT NULL CHECK (entitlement_type IN ('bst_product','course','category','plan')),
  resource_id text NOT NULL,
  source text NOT NULL DEFAULT 'asaas',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asaas_payment_id, entitlement_type, resource_id)
);

GRANT SELECT ON public.asaas_access_entitlements TO authenticated;
GRANT ALL ON public.asaas_access_entitlements TO service_role;
ALTER TABLE public.asaas_access_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ASAAS entitlements"
ON public.asaas_access_entitlements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX asaas_access_entitlements_user_active_idx
ON public.asaas_access_entitlements (user_id, status, entitlement_type, resource_id);
CREATE INDEX asaas_access_entitlements_subscription_idx
ON public.asaas_access_entitlements (asaas_subscription_id)
WHERE asaas_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_access_from_asaas(
  _user_id uuid,
  _asaas_payment_id text,
  _product_key text,
  _raw jsonb DEFAULT NULL::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prod public.payment_products;
  _payment public.asaas_payments;
  _bundle_ids uuid[];
  _all_ids uuid[];
  _bst_count int := 0;
  _course_count int := 0;
  _entitlement_count int := 0;
  _any_course boolean := false;
  _cat text;
  _source text := 'asaas:' || _asaas_payment_id;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _payment
  FROM public.asaas_payments
  WHERE asaas_payment_id = _asaas_payment_id;

  IF _payment.id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'payment_not_recorded');
  END IF;

  IF upper(coalesce(_payment.status, '')) NOT IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'payment_not_confirmed', 'status', _payment.status);
  END IF;

  SELECT * INTO _prod
  FROM public.payment_products
  WHERE product_key = _product_key AND active = true;

  IF _prod.id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_product');
  END IF;

  IF _payment.access_granted_at IS NOT NULL THEN
    RETURN jsonb_build_object('granted', true, 'product_key', _product_key, 'already_processed', true);
  END IF;

  SELECT COALESCE(array_agg(included_product_id), ARRAY[]::uuid[])
  INTO _bundle_ids
  FROM public.payment_product_bundles
  WHERE product_id = _prod.id;
  _all_ids := ARRAY[_prod.id] || _bundle_ids;

  INSERT INTO public.asaas_access_entitlements (
    user_id, asaas_payment_id, asaas_subscription_id, payment_product_id,
    entitlement_type, resource_id, source
  )
  SELECT DISTINCT _user_id, _asaas_payment_id, _payment.asaas_subscription_id,
    pp.id, 'bst_product', pp.grants_bst_product_id::text, 'asaas'
  FROM public.payment_products pp
  WHERE pp.id = ANY(_all_ids) AND pp.grants_bst_product_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO public.asaas_access_entitlements (
    user_id, asaas_payment_id, asaas_subscription_id, payment_product_id,
    entitlement_type, resource_id, source
  )
  SELECT DISTINCT _user_id, _asaas_payment_id, _payment.asaas_subscription_id,
    ppc.product_id, 'course', ppc.course_id::text, 'asaas'
  FROM public.payment_product_courses ppc
  WHERE ppc.product_id = ANY(_all_ids)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.asaas_access_entitlements (
    user_id, asaas_payment_id, asaas_subscription_id, payment_product_id,
    entitlement_type, resource_id, source
  )
  SELECT DISTINCT _user_id, _asaas_payment_id, _payment.asaas_subscription_id,
    pp.id, 'category', pp.grants_category, 'asaas'
  FROM public.payment_products pp
  WHERE pp.id = ANY(_all_ids) AND pp.grants_category IS NOT NULL
  ON CONFLICT DO NOTHING;

  IF _prod.plan_tier IS NOT NULL THEN
    INSERT INTO public.asaas_access_entitlements (
      user_id, asaas_payment_id, asaas_subscription_id, payment_product_id,
      entitlement_type, resource_id, source
    ) VALUES (
      _user_id, _asaas_payment_id, _payment.asaas_subscription_id,
      _prod.id, 'plan', lower(_prod.plan_tier), 'asaas'
    ) ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO _entitlement_count
  FROM public.asaas_access_entitlements
  WHERE asaas_payment_id = _asaas_payment_id AND status = 'active';

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
    SELECT bool_or(grants_course_access) AS any_course,
      bool_or(grants_ebook1_access) AS any_ebook1,
      bool_or(grants_ebook2_access) AS any_ebook2,
      bool_or(grants_ebook3_access) AS any_ebook3,
      COALESCE(sum(grants_scripted_seconds), 0)::int AS total_scripted,
      COALESCE(sum(grants_unscripted_seconds), 0)::int AS total_unscripted
    FROM public.payment_products WHERE id = ANY(_all_ids)
  ) agg
  WHERE p.user_id = _user_id;

  INSERT INTO public.user_course_access (user_id, course_id, source)
  SELECT DISTINCT _user_id, ppc.course_id, _source
  FROM public.payment_product_courses ppc
  WHERE ppc.product_id = ANY(_all_ids)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _course_count = ROW_COUNT;

  INSERT INTO public.bst_product_access (user_id, product_id, source)
  SELECT DISTINCT _user_id, pp.grants_bst_product_id, _source
  FROM public.payment_products pp
  WHERE pp.id = ANY(_all_ids) AND pp.grants_bst_product_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _bst_count = ROW_COUNT;

  SELECT COALESCE(bool_or(grants_course_access), false) INTO _any_course
  FROM public.payment_products WHERE id = ANY(_all_ids);

  FOR _cat IN
    SELECT DISTINCT pp.grants_category
    FROM public.payment_products pp
    WHERE pp.id = ANY(_all_ids) AND pp.grants_category IS NOT NULL
    ORDER BY pp.grants_category
  LOOP
    PERFORM public.apply_student_category(_user_id, _cat, _source);
  END LOOP;

  IF NOT _any_course AND _prod.plan_tier IS NULL
     AND EXISTS (SELECT 1 FROM public.payment_products WHERE id = ANY(_all_ids) AND grants_bst_product_id IS NOT NULL) THEN
    UPDATE public.profiles p SET plan_tier = 'bst', updated_at = now()
    WHERE p.user_id = _user_id
      AND COALESCE(p.has_course_access, false) = false
      AND lower(COALESCE(p.plan_tier, '')) NOT IN ('pro','vip','kids','teens')
      AND NOT public.has_open_category_raw(_user_id)
      AND NOT EXISTS (SELECT 1 FROM public.user_course_access uca WHERE uca.user_id = _user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.asaas_subscriptions s
        WHERE s.user_id = _user_id AND lower(s.status) IN ('active','overdue')
      );
  END IF;

  UPDATE public.asaas_payments
  SET product_key = _product_key,
      access_granted_at = now(),
      access_grant_result = jsonb_build_object(
        'granted', true, 'product_key', _product_key,
        'bundle_items', cardinality(_bundle_ids),
        'entitlements', _entitlement_count,
        'courses_granted', _course_count,
        'bst_granted', _bst_count,
        'already_processed', false
      ),
      updated_at = now()
  WHERE asaas_payment_id = _asaas_payment_id;

  RETURN (SELECT access_grant_result FROM public.asaas_payments WHERE asaas_payment_id = _asaas_payment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_access_from_asaas(
  _user_id uuid,
  _asaas_payment_id text DEFAULT NULL,
  _asaas_subscription_id text DEFAULT NULL,
  _reason text DEFAULT 'revoked'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _revoked int := 0;
  _row record;
  _source text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _asaas_payment_id IS NULL AND _asaas_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Payment or subscription id is required';
  END IF;

  FOR _row IN
    SELECT * FROM public.asaas_access_entitlements e
    WHERE e.user_id = _user_id AND e.status = 'active'
      AND ((_asaas_subscription_id IS NOT NULL AND e.asaas_subscription_id = _asaas_subscription_id)
        OR (_asaas_subscription_id IS NULL AND e.asaas_payment_id = _asaas_payment_id))
  LOOP
    UPDATE public.asaas_access_entitlements
    SET status='revoked', revoked_at=now(), revoke_reason=_reason, updated_at=now()
    WHERE id=_row.id;
    _revoked := _revoked + 1;
    _source := 'asaas:' || _row.asaas_payment_id;

    IF _row.entitlement_type = 'bst_product' AND NOT EXISTS (
      SELECT 1 FROM public.asaas_access_entitlements e
      WHERE e.user_id=_user_id AND e.entitlement_type='bst_product'
        AND e.resource_id=_row.resource_id AND e.status='active'
    ) THEN
      DELETE FROM public.bst_product_access
      WHERE user_id=_user_id AND product_id=_row.resource_id::uuid AND source=_source;
    ELSIF _row.entitlement_type = 'course' AND NOT EXISTS (
      SELECT 1 FROM public.asaas_access_entitlements e
      WHERE e.user_id=_user_id AND e.entitlement_type='course'
        AND e.resource_id=_row.resource_id AND e.status='active'
    ) THEN
      DELETE FROM public.user_course_access
      WHERE user_id=_user_id AND course_id=_row.resource_id::uuid AND source=_source;
    ELSIF _row.entitlement_type = 'category' AND NOT EXISTS (
      SELECT 1 FROM public.asaas_access_entitlements e
      WHERE e.user_id=_user_id AND e.entitlement_type='category'
        AND e.resource_id=_row.resource_id AND e.status='active'
    ) THEN
      DELETE FROM public.student_categories
      WHERE user_id=_user_id AND code=_row.resource_id AND source=_source;
    END IF;
  END LOOP;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  UPDATE public.profiles p SET
    has_course_access = EXISTS (SELECT 1 FROM public.user_course_access u WHERE u.user_id=_user_id),
    plan_tier = CASE
      WHEN EXISTS (SELECT 1 FROM public.asaas_access_entitlements e WHERE e.user_id=_user_id AND e.status='active' AND e.entitlement_type='plan' AND e.resource_id='vip') THEN 'vip'
      WHEN EXISTS (SELECT 1 FROM public.asaas_access_entitlements e WHERE e.user_id=_user_id AND e.status='active' AND e.entitlement_type='plan' AND e.resource_id='pro') THEN 'pro'
      WHEN EXISTS (SELECT 1 FROM public.asaas_access_entitlements e WHERE e.user_id=_user_id AND e.status='active' AND e.entitlement_type='plan' AND e.resource_id='teens') THEN 'teens'
      WHEN EXISTS (SELECT 1 FROM public.asaas_access_entitlements e WHERE e.user_id=_user_id AND e.status='active' AND e.entitlement_type='plan' AND e.resource_id='kids') THEN 'kids'
      WHEN EXISTS (SELECT 1 FROM public.bst_product_access b WHERE b.user_id=_user_id) THEN 'bst'
      ELSE 'open' END,
    updated_at=now()
  WHERE p.user_id=_user_id;

  RETURN jsonb_build_object('revoked', _revoked, 'reason', _reason);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_access_from_asaas(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_access_from_asaas(uuid,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.grant_access_from_asaas(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_access_from_asaas(uuid,text,text,jsonb) TO service_role;