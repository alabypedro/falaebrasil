ALTER TABLE public.asaas_payments
  ADD COLUMN IF NOT EXISTS access_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_grant_result jsonb;

CREATE OR REPLACE FUNCTION public.grant_access_from_asaas(
  _user_id uuid,
  _asaas_payment_id text,
  _product_key text,
  _raw jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _prod public.payment_products;
  _already boolean;
  _result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _prod
  FROM public.payment_products
  WHERE product_key = _product_key
    AND active = true;

  IF _prod.id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_product');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.asaas_payments
    WHERE asaas_payment_id = _asaas_payment_id
      AND access_granted_at IS NOT NULL
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object(
      'granted', true,
      'product_key', _product_key,
      'already_processed', true
    );
  END IF;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);

  UPDATE public.profiles SET
    has_course_access = CASE WHEN _prod.grants_course_access THEN true ELSE has_course_access END,
    has_ebook1_access = CASE WHEN _prod.grants_ebook1_access THEN true ELSE has_ebook1_access END,
    has_ebook2_access = CASE WHEN _prod.grants_ebook2_access THEN true ELSE has_ebook2_access END,
    has_ebook3_access = CASE WHEN _prod.grants_ebook3_access THEN true ELSE has_ebook3_access END,
    scripted_balance = scripted_balance + COALESCE(_prod.grants_scripted_seconds, 0),
    unscripted_balance = unscripted_balance + COALESCE(_prod.grants_unscripted_seconds, 0),
    plan_tier = COALESCE(_prod.plan_tier, plan_tier),
    subscription_status = CASE WHEN _prod.type = 'subscription' THEN 'active' ELSE subscription_status END,
    updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.user_course_access (user_id, course_id, source)
  SELECT _user_id, ppc.course_id, 'asaas'
  FROM public.payment_product_courses ppc
  WHERE ppc.product_id = _prod.id
  ON CONFLICT DO NOTHING;

  _result := jsonb_build_object(
    'granted', true,
    'product_key', _product_key,
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