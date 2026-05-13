
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'open';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_tier_check CHECK (plan_tier IN ('open','pro','vip'));

ALTER TABLE public.fb_communities ADD COLUMN IF NOT EXISTS required_tier text NOT NULL DEFAULT 'open';
ALTER TABLE public.fb_communities DROP CONSTRAINT IF EXISTS fb_communities_required_tier_check;
ALTER TABLE public.fb_communities ADD CONSTRAINT fb_communities_required_tier_check CHECK (required_tier IN ('open','pro'));
UPDATE public.fb_communities SET required_tier = 'open';

CREATE TABLE IF NOT EXISTS public.vip_config (
  id integer PRIMARY KEY DEFAULT 1,
  teacher_chat_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vip_config_singleton CHECK (id = 1)
);
INSERT INTO public.vip_config (id, teacher_chat_url) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.vip_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view vip_config" ON public.vip_config;
CREATE POLICY "Authenticated can view vip_config" ON public.vip_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage vip_config" ON public.vip_config;
CREATE POLICY "Admins manage vip_config" ON public.vip_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tier_rank(_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(coalesce(_tier,'open'))
    WHEN 'open' THEN 1 WHEN 'pro' THEN 2 WHEN 'vip' THEN 3 ELSE 1 END
$$;

CREATE OR REPLACE FUNCTION public.has_tier(_required text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND public.tier_rank(p.plan_tier) >= public.tier_rank(_required))
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

DROP POLICY IF EXISTS "Block users from editing protected profile fields" ON public.profiles;
CREATE POLICY "Block users from editing protected profile fields"
  ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    auth.role() = 'service_role'
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles old
      WHERE old.user_id = profiles.user_id
        AND (
          old.has_course_access IS DISTINCT FROM profiles.has_course_access
          OR old.has_a2_access IS DISTINCT FROM profiles.has_a2_access
          OR old.has_b1_access IS DISTINCT FROM profiles.has_b1_access
          OR old.has_b2_access IS DISTINCT FROM profiles.has_b2_access
          OR old.has_ebook1_access IS DISTINCT FROM profiles.has_ebook1_access
          OR old.has_ebook2_access IS DISTINCT FROM profiles.has_ebook2_access
          OR old.has_ebook3_access IS DISTINCT FROM profiles.has_ebook3_access
          OR old.scripted_balance IS DISTINCT FROM profiles.scripted_balance
          OR old.unscripted_balance IS DISTINCT FROM profiles.unscripted_balance
          OR old.hubla_customer_id IS DISTINCT FROM profiles.hubla_customer_id
          OR old.user_type IS DISTINCT FROM profiles.user_type
          OR old.plan_tier IS DISTINCT FROM profiles.plan_tier
          OR old.subscription_status IS DISTINCT FROM profiles.subscription_status
          OR old.subscription_current_period_end IS DISTINCT FROM profiles.subscription_current_period_end
          OR old.subscription_grace_until IS DISTINCT FROM profiles.subscription_grace_until
          OR old.hubla_subscription_id IS DISTINCT FROM profiles.hubla_subscription_id
        )
    )
  );

ALTER TABLE public.hubla_product_mapping DROP CONSTRAINT IF EXISTS hubla_product_mapping_product_key_check;
ALTER TABLE public.hubla_product_mapping ADD CONSTRAINT hubla_product_mapping_product_key_check
  CHECK (product_key = ANY (ARRAY['essencial_pro_a1','ebook1','ebook2','ebook3','plano_pro','plano_vip']));

INSERT INTO public.hubla_product_mapping (product_key, display_name, is_subscription)
VALUES
  ('plano_pro', 'Plano PRO (grupos WhatsApp)', true),
  ('plano_vip', 'Plano VIP (aula particular)', true)
ON CONFLICT (product_key) DO NOTHING;
