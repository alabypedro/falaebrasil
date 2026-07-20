
-- =========================================
-- 1. Enums
-- =========================================
DO $$ BEGIN
  CREATE TYPE public.payment_product_type AS ENUM ('subscription', 'one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_billing_cycle AS ENUM ('MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY', 'SEMIANNUALLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- 2. payment_products (catálogo)
-- =========================================
CREATE TABLE IF NOT EXISTS public.payment_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  type public.payment_product_type NOT NULL DEFAULT 'one_time',
  price_cents integer NOT NULL DEFAULT 0,
  billing_cycle public.payment_billing_cycle,
  active boolean NOT NULL DEFAULT true,
  grants_course_access boolean NOT NULL DEFAULT false,
  grants_ebook1_access boolean NOT NULL DEFAULT false,
  grants_ebook2_access boolean NOT NULL DEFAULT false,
  grants_ebook3_access boolean NOT NULL DEFAULT false,
  grants_scripted_seconds integer NOT NULL DEFAULT 0,
  grants_unscripted_seconds integer NOT NULL DEFAULT 0,
  plan_tier text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_products TO authenticated;
GRANT ALL ON public.payment_products TO service_role;
ALTER TABLE public.payment_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active products"
  ON public.payment_products FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage products"
  ON public.payment_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_payment_products_updated_at
  BEFORE UPDATE ON public.payment_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 3. payment_product_courses
-- =========================================
CREATE TABLE IF NOT EXISTS public.payment_product_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.payment_products(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, course_id)
);
GRANT SELECT ON public.payment_product_courses TO authenticated;
GRANT ALL ON public.payment_product_courses TO service_role;
ALTER TABLE public.payment_product_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product courses"
  ON public.payment_product_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage product courses"
  ON public.payment_product_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 4. asaas_customers
-- =========================================
CREATE TABLE IF NOT EXISTS public.asaas_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_customer_id text NOT NULL UNIQUE,
  cpf_cnpj text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asaas_customers TO authenticated;
GRANT ALL ON public.asaas_customers TO service_role;
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own asaas customer"
  ON public.asaas_customers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage asaas customers"
  ON public.asaas_customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_asaas_customers_updated_at
  BEFORE UPDATE ON public.asaas_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 5. asaas_subscriptions
-- =========================================
CREATE TABLE IF NOT EXISTS public.asaas_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_subscription_id text NOT NULL UNIQUE,
  product_key text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  cycle public.payment_billing_cycle,
  value_cents integer NOT NULL DEFAULT 0,
  next_due_date date,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asaas_subscriptions TO authenticated;
GRANT ALL ON public.asaas_subscriptions TO service_role;
ALTER TABLE public.asaas_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscriptions"
  ON public.asaas_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage subscriptions"
  ON public.asaas_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_asaas_subscriptions_updated_at
  BEFORE UPDATE ON public.asaas_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_asaas_subs_user ON public.asaas_subscriptions(user_id);

-- =========================================
-- 6. asaas_payments
-- =========================================
CREATE TABLE IF NOT EXISTS public.asaas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  asaas_payment_id text NOT NULL UNIQUE,
  asaas_subscription_id text,
  product_key text,
  status text NOT NULL,
  billing_type text,
  value_cents integer NOT NULL DEFAULT 0,
  net_value_cents integer,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  pix_copy_paste text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asaas_payments TO authenticated;
GRANT ALL ON public.asaas_payments TO service_role;
ALTER TABLE public.asaas_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payments"
  ON public.asaas_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage payments"
  ON public.asaas_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_asaas_payments_updated_at
  BEFORE UPDATE ON public.asaas_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_asaas_payments_user ON public.asaas_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_sub ON public.asaas_payments(asaas_subscription_id);

-- =========================================
-- 7. asaas_webhook_events (idempotência)
-- =========================================
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  raw_payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  error text
);
GRANT ALL ON public.asaas_webhook_events TO service_role;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook events"
  ON public.asaas_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 8. profiles: novos campos ASAAS
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text;

-- Proteger novos campos contra escalada de privilégio
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('app.bypass_profile_protection', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.has_course_access IS DISTINCT FROM OLD.has_course_access
     OR NEW.has_a2_access IS DISTINCT FROM OLD.has_a2_access
     OR NEW.has_b1_access IS DISTINCT FROM OLD.has_b1_access
     OR NEW.has_b2_access IS DISTINCT FROM OLD.has_b2_access
     OR NEW.has_ebook1_access IS DISTINCT FROM OLD.has_ebook1_access
     OR NEW.has_ebook2_access IS DISTINCT FROM OLD.has_ebook2_access
     OR NEW.has_ebook3_access IS DISTINCT FROM OLD.has_ebook3_access
     OR NEW.scripted_balance IS DISTINCT FROM OLD.scripted_balance
     OR NEW.unscripted_balance IS DISTINCT FROM OLD.unscripted_balance
     OR NEW.hubla_customer_id IS DISTINCT FROM OLD.hubla_customer_id
     OR NEW.asaas_customer_id IS DISTINCT FROM OLD.asaas_customer_id
     OR NEW.asaas_subscription_id IS DISTINCT FROM OLD.asaas_subscription_id
     OR NEW.xp IS DISTINCT FROM OLD.xp
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.plan_tier IS DISTINCT FROM OLD.plan_tier
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
     OR NEW.subscription_grace_until IS DISTINCT FROM OLD.subscription_grace_until
     OR NEW.hubla_subscription_id IS DISTINCT FROM OLD.hubla_subscription_id
  THEN RAISE EXCEPTION 'Not allowed to modify protected profile fields'; END IF;
  RETURN NEW;
END; $function$;

-- =========================================
-- 9. RPC grant_access_from_asaas
-- =========================================
CREATE OR REPLACE FUNCTION public.grant_access_from_asaas(
  _user_id uuid,
  _asaas_payment_id text,
  _product_key text,
  _raw jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _prod public.payment_products;
  _already boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Idempotência: se já processamos esse payment, não concede de novo
  SELECT EXISTS (
    SELECT 1 FROM public.asaas_payments
    WHERE asaas_payment_id = _asaas_payment_id AND paid_at IS NOT NULL
  ) INTO _already;

  SELECT * INTO _prod FROM public.payment_products WHERE product_key = _product_key;
  IF _prod.id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_product');
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
    subscription_status = CASE WHEN _prod.type = 'subscription' THEN 'active' ELSE subscription_status END
  WHERE user_id = _user_id;

  -- Vínculo com cursos específicos do produto
  INSERT INTO public.user_course_access (user_id, course_id)
  SELECT _user_id, ppc.course_id
  FROM public.payment_product_courses ppc
  WHERE ppc.product_id = _prod.id
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'granted', true,
    'product_key', _product_key,
    'already_processed', _already
  );
END;
$function$;

-- =========================================
-- 10. Seed dos 4 produtos iniciais
-- =========================================
INSERT INTO public.payment_products
  (product_key, name, description, type, price_cents, billing_cycle,
   grants_course_access, grants_ebook1_access, grants_ebook2_access, grants_ebook3_access,
   plan_tier, display_order)
VALUES
  ('plano_open', 'Plano OPEN', 'Acesso mensal ao curso Falaê Brasil', 'subscription', 0, 'MONTHLY',
   true, false, false, false, 'open', 1),
  ('ebook_anfitriao', 'Ebook: Anfitrião Soberano', 'Ebook exclusivo Falaê', 'one_time', 0, NULL,
   false, true, false, false, NULL, 2),
  ('ebook_decodificador', 'Ebook: O Decodificador de Gringo', 'Ebook exclusivo Falaê', 'one_time', 0, NULL,
   false, false, true, false, NULL, 3),
  ('ebook_vocabulario', 'Ebook: O Vocabulário de Poder', 'Ebook exclusivo Falaê', 'one_time', 0, NULL,
   false, false, false, true, NULL, 4)
ON CONFLICT (product_key) DO NOTHING;
