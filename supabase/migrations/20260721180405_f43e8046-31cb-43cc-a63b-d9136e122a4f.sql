
-- BUNDLES (combos)
CREATE TABLE public.payment_product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.payment_products(id) ON DELETE CASCADE,
  included_product_id uuid NOT NULL REFERENCES public.payment_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, included_product_id),
  CHECK (product_id <> included_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_product_bundles TO authenticated;
GRANT ALL ON public.payment_product_bundles TO service_role;
ALTER TABLE public.payment_product_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bundles"
  ON public.payment_product_bundles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read bundles"
  ON public.payment_product_bundles
  FOR SELECT TO authenticated
  USING (true);

-- COUPONS (alternative payment links)
CREATE TABLE public.payment_product_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.payment_products(id) ON DELETE CASCADE,
  code text NOT NULL,
  checkout_url text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_product_coupons TO authenticated;
GRANT ALL ON public.payment_product_coupons TO service_role;
GRANT SELECT ON public.payment_product_coupons TO anon;
ALTER TABLE public.payment_product_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons"
  ON public.payment_product_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read active coupons"
  ON public.payment_product_coupons
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_payment_product_coupons_updated_at
  BEFORE UPDATE ON public.payment_product_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Updated grant function: applies parent product + bundled items
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

  -- Collect all products to apply: parent + bundle children
  SELECT COALESCE(array_agg(included_product_id), ARRAY[]::uuid[]) INTO _bundle_ids
  FROM public.payment_product_bundles WHERE product_id = _prod.id;

  _all_ids := ARRAY[_prod.id] || _bundle_ids;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);

  -- Aggregate all boolean/seconds grants from all included products
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

  -- Grant course access for parent + all bundled items
  INSERT INTO public.user_course_access (user_id, course_id, source)
  SELECT _user_id, ppc.course_id, 'asaas'
  FROM public.payment_product_courses ppc
  WHERE ppc.product_id = ANY(_all_ids)
  ON CONFLICT DO NOTHING;

  _result := jsonb_build_object(
    'granted', true,
    'product_key', _product_key,
    'bundle_items', array_length(_bundle_ids, 1),
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
