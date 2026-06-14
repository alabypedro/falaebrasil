
-- Fix 1: protect best_writing_score
DROP POLICY IF EXISTS "Block users from editing protected profile fields" ON public.profiles;
CREATE POLICY "Block users from editing protected profile fields"
ON public.profiles AS RESTRICTIVE FOR UPDATE
USING (true)
WITH CHECK (
  auth.role() = 'service_role'
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles old
    WHERE old.user_id = profiles.user_id
      AND (
        old.has_course_access IS DISTINCT FROM profiles.has_course_access
        OR old.has_ebook1_access IS DISTINCT FROM profiles.has_ebook1_access
        OR old.has_ebook2_access IS DISTINCT FROM profiles.has_ebook2_access
        OR old.has_ebook3_access IS DISTINCT FROM profiles.has_ebook3_access
        OR old.hubla_customer_id IS DISTINCT FROM profiles.hubla_customer_id
        OR old.scripted_balance IS DISTINCT FROM profiles.scripted_balance
        OR old.unscripted_balance IS DISTINCT FROM profiles.unscripted_balance
        OR old.plan_tier IS DISTINCT FROM profiles.plan_tier
        OR old.user_type IS DISTINCT FROM profiles.user_type
        OR old.subscription_status IS DISTINCT FROM profiles.subscription_status
        OR old.subscription_current_period_end IS DISTINCT FROM profiles.subscription_current_period_end
        OR old.subscription_grace_until IS DISTINCT FROM profiles.subscription_grace_until
        OR old.hubla_subscription_id IS DISTINCT FROM profiles.hubla_subscription_id
        OR old.has_a2_access IS DISTINCT FROM profiles.has_a2_access
        OR old.has_b1_access IS DISTINCT FROM profiles.has_b1_access
        OR old.has_b2_access IS DISTINCT FROM profiles.has_b2_access
        OR old.xp IS DISTINCT FROM profiles.xp
        OR old.level IS DISTINCT FROM profiles.level
        OR old.streak_days IS DISTINCT FROM profiles.streak_days
        OR old.best_scripted_score IS DISTINCT FROM profiles.best_scripted_score
        OR old.best_unscripted_score IS DISTINCT FROM profiles.best_unscripted_score
        OR old.best_listening_score IS DISTINCT FROM profiles.best_listening_score
        OR old.best_writing_score IS DISTINCT FROM profiles.best_writing_score
        OR old.last_activity IS DISTINCT FROM profiles.last_activity
      )
  )
);

-- Fix 2: Realtime channel subscription must verify CEFR level access
DROP POLICY IF EXISTS "Authenticated can subscribe to accessible channels" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to accessible channels"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE (realtime.topic() = c.id::text OR realtime.topic() = 'community-channel-' || c.id::text)
      AND public.can_access_level(c.level)
  )
);

DROP POLICY IF EXISTS "Authenticated can broadcast to accessible channels" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to accessible channels"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE (realtime.topic() = c.id::text OR realtime.topic() = 'community-channel-' || c.id::text)
      AND public.can_access_level(c.level)
  )
);
