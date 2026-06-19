ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_a2_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_b1_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_b2_access boolean NOT NULL DEFAULT false;

-- Update privilege-escalation trigger to also protect new flags
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

-- Replace restrictive UPDATE policy to include new flags
DROP POLICY IF EXISTS "Block users from editing protected profile fields" ON public.profiles;

CREATE POLICY "Block users from editing protected profile fields"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
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
        OR old.subscription_status IS DISTINCT FROM profiles.subscription_status
        OR old.subscription_current_period_end IS DISTINCT FROM profiles.subscription_current_period_end
        OR old.subscription_grace_until IS DISTINCT FROM profiles.subscription_grace_until
        OR old.hubla_subscription_id IS DISTINCT FROM profiles.hubla_subscription_id
      )
  )
);