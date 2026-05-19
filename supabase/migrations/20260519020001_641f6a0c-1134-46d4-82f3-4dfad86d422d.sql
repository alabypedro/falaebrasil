-- 1. Realtime Security: Restrict access to realtime.messages
-- Enable RLS on realtime.messages if not already enabled (though it was seen as true)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on realtime.messages to ensure a clean state
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'realtime' AND policyname = 'Authenticated can subscribe to accessible channels') THEN
        DROP POLICY "Authenticated can subscribe to accessible channels" ON realtime.messages;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'realtime' AND policyname = 'Authenticated can broadcast to accessible channels') THEN
        DROP POLICY "Authenticated can broadcast to accessible channels" ON realtime.messages;
    END IF;
END $$;

-- Policy for subscribing (SELECT)
CREATE POLICY "Authenticated can subscribe to accessible channels" ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE (
      public.can_access_level(c.level) AND (
        realtime.topic() = c.id::text OR 
        realtime.topic() = 'community-channel-' || c.id::text OR
        realtime.topic() LIKE '%' || c.id::text || '%'
      )
    )
  )
);

-- Policy for broadcasting (INSERT)
CREATE POLICY "Authenticated can broadcast to accessible channels" ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE (
      public.can_access_level(c.level) AND (
        realtime.topic() = c.id::text OR 
        realtime.topic() = 'community-channel-' || c.id::text OR
        realtime.topic() LIKE '%' || c.id::text || '%'
      )
    )
  )
);


-- 2. Profiles Table: Restrict update of sensitive fields
-- Drop the existing policy to recreate it with all required fields
DROP POLICY IF EXISTS "Block users from editing protected profile fields" ON public.profiles;

CREATE POLICY "Block users from editing protected profile fields" 
ON public.profiles 
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  (auth.role() = 'service_role') OR (
    NOT (
      EXISTS (
        SELECT 1 FROM public.profiles old 
        WHERE old.user_id = public.profiles.user_id 
        AND (
          old.has_course_access IS DISTINCT FROM public.profiles.has_course_access OR
          old.has_ebook1_access IS DISTINCT FROM public.profiles.has_ebook1_access OR
          old.has_ebook2_access IS DISTINCT FROM public.profiles.has_ebook2_access OR
          old.has_ebook3_access IS DISTINCT FROM public.profiles.has_ebook3_access OR
          old.hubla_customer_id IS DISTINCT FROM public.profiles.hubla_customer_id OR
          old.scripted_balance IS DISTINCT FROM public.profiles.scripted_balance OR
          old.unscripted_balance IS DISTINCT FROM public.profiles.unscripted_balance OR
          old.plan_tier IS DISTINCT FROM public.profiles.plan_tier OR
          old.user_type IS DISTINCT FROM public.profiles.user_type OR
          old.subscription_status IS DISTINCT FROM public.profiles.subscription_status OR
          old.subscription_current_period_end IS DISTINCT FROM public.profiles.subscription_current_period_end OR
          old.subscription_grace_until IS DISTINCT FROM public.profiles.subscription_grace_until OR
          old.hubla_subscription_id IS DISTINCT FROM public.profiles.hubla_subscription_id OR
          old.has_a2_access IS DISTINCT FROM public.profiles.has_a2_access OR
          old.has_b1_access IS DISTINCT FROM public.profiles.has_b1_access OR
          old.has_b2_access IS DISTINCT FROM public.profiles.has_b2_access
        )
      )
    )
  )
);


-- 3. fb_communities: Restricted SELECT
-- Update the SELECT policy to filter by required_tier and access_key
DROP POLICY IF EXISTS "Users view communities they have access to" ON public.fb_communities;

CREATE POLICY "Users view communities they have access to" 
ON public.fb_communities 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  all_tiers = true OR
  (
    public.has_bst_item_access(access_key) AND 
    (
      required_tier = 'open' OR 
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND (
          p.plan_tier = required_tier OR 
          public.tier_rank(p.plan_tier) >= public.tier_rank(required_tier)
        )
      )
    )
  )
);