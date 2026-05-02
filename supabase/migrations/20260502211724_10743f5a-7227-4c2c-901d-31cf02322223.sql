-- ============================================
-- 1) Profiles: explicit RESTRICTIVE policy (scanner-visible)
-- The trigger already blocks this, but adding a policy makes the
-- intent explicit and visible to security scanners / linters.
-- ============================================
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
        OR old.has_ebook1_access IS DISTINCT FROM profiles.has_ebook1_access
        OR old.has_ebook2_access IS DISTINCT FROM profiles.has_ebook2_access
        OR old.has_ebook3_access IS DISTINCT FROM profiles.has_ebook3_access
        OR old.scripted_balance IS DISTINCT FROM profiles.scripted_balance
        OR old.unscripted_balance IS DISTINCT FROM profiles.unscripted_balance
        OR old.hubla_customer_id IS DISTINCT FROM profiles.hubla_customer_id
        OR old.user_type IS DISTINCT FROM profiles.user_type
      )
  )
);

-- ============================================
-- 2) Realtime: gate channel subscriptions by level access
-- The realtime.messages table needs RLS so users can only subscribe
-- to topics for community channels they have access to.
-- Topic format used by the app: 'community-channel-<channel_id>' or
-- the channel UUID itself. We accept either.
-- ============================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to accessible channels" ON realtime.messages;

CREATE POLICY "Authenticated can subscribe to accessible channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE public.can_access_level(c.level)
      AND (
        realtime.topic() = c.id::text
        OR realtime.topic() = 'community-channel-' || c.id::text
        OR realtime.topic() LIKE '%' || c.id::text || '%'
      )
  )
);