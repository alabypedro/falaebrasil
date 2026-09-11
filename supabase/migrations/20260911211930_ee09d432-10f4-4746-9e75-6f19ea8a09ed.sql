-- Restrict direct table reads to authenticated users only
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.payment_product_coupons;

CREATE POLICY "Authenticated can read active coupons"
ON public.payment_product_coupons
FOR SELECT
TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- Secure lookup for the public promo page: returns a single coupon by exact code
CREATE OR REPLACE FUNCTION public.get_coupon_by_code(_code text)
RETURNS TABLE(code text, checkout_url text, price_cents integer, product_name text, product_description text, product_price_cents integer, product_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code, c.checkout_url, c.price_cents,
         p.name, p.description, p.price_cents, p.type::text
  FROM public.payment_product_coupons c
  JOIN public.payment_products p ON p.id = c.product_id
  WHERE c.active = true AND p.active = true AND upper(c.code) = upper(trim(_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_coupon_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coupon_by_code(text) TO anon, authenticated;
