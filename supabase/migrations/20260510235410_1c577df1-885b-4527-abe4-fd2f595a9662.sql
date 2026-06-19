
-- Add subscription tracking fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS hubla_subscription_id text;

-- Mark products as subscription-based
ALTER TABLE public.hubla_product_mapping
  ADD COLUMN IF NOT EXISTS is_subscription boolean NOT NULL DEFAULT false;

-- Replace the privilege-escalation trigger so users still cannot edit
-- the subscription / access fields, but service_role and bypass writes can.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_profile_protection', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.has_course_access IS DISTINCT FROM OLD.has_course_access
     OR NEW.has_ebook1_access IS DISTINCT FROM OLD.has_ebook1_access
     OR NEW.has_ebook2_access IS DISTINCT FROM OLD.has_ebook2_access
     OR NEW.has_ebook3_access IS DISTINCT FROM OLD.has_ebook3_access
     OR NEW.scripted_balance IS DISTINCT FROM OLD.scripted_balance
     OR NEW.unscripted_balance IS DISTINCT FROM OLD.unscripted_balance
     OR NEW.hubla_customer_id IS DISTINCT FROM OLD.hubla_customer_id
     OR NEW.xp IS DISTINCT FROM OLD.xp
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
     OR NEW.subscription_grace_until IS DISTINCT FROM OLD.subscription_grace_until
     OR NEW.hubla_subscription_id IS DISTINCT FROM OLD.hubla_subscription_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

-- Replace the equivalent guard policy on profiles (NO INSERT/UPDATE on these new cols)
DROP POLICY IF EXISTS "Block users from editing protected profile fields" ON public.profiles;
CREATE POLICY "Block users from editing protected profile fields"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  (auth.role() = 'service_role')
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles old
    WHERE old.user_id = profiles.user_id
      AND (
        old.has_course_access IS DISTINCT FROM profiles.has_course_access
        OR old.has_ebook1_access IS DISTINCT FROM profiles.has_ebook1_access
        OR old.has_ebook2_access IS DISTINCT FROM profiles.has_ebook2_access
        OR old.has_ebook3_access IS DISTINCT FROM profiles.has_ebook3_access
        OR old.scripted_balance IS DISTINCT FROM profiles.scripted_balance
        OR old.unscripted_balance IS DISTINCT FROM profiles.unscripted_balance
        OR old.hubla_customer_id IS DISTINCT FROM profiles.hubla_customer_id
        OR old.user_type IS DISTINCT FROM profiles.user_type
        OR old.subscription_status IS DISTINCT FROM profiles.subscription_status
        OR old.subscription_current_period_end IS DISTINCT FROM profiles.subscription_current_period_end
        OR old.subscription_grace_until IS DISTINCT FROM profiles.subscription_grace_until
        OR old.hubla_subscription_id IS DISTINCT FROM profiles.hubla_subscription_id
      )
  )
);

-- Function to block access for users past the 10-day grace period.
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _affected int;
BEGIN
  PERFORM set_config('app.bypass_profile_protection', 'on', true);

  WITH upd AS (
    UPDATE public.profiles
    SET
      has_course_access = false,
      has_ebook1_access = false,
      has_ebook2_access = false,
      has_ebook3_access = false,
      subscription_status = 'canceled'
    WHERE subscription_status = 'past_due'
      AND subscription_grace_until IS NOT NULL
      AND subscription_grace_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO _affected FROM upd;

  RETURN jsonb_build_object('expired', _affected, 'ran_at', now());
END;
$function$;

-- Schedule daily expiration check (requires pg_cron + pg_net which are
-- already enabled in this project). Idempotent re-create:
DO $$
BEGIN
  PERFORM cron.unschedule('expire-overdue-subscriptions-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-overdue-subscriptions-daily',
  '0 3 * * *',
  $$ SELECT public.expire_overdue_subscriptions(); $$
);
