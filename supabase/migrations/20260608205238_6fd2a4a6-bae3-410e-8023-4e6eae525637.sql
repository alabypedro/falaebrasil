-- Fix fb_communities SELECT policy: when all_tiers=true, only OPEN/PRO/VIP plans should see it
-- (not anonymous-like access, not KIDS/TEENS audiences), and respect access_key gating
DROP POLICY IF EXISTS "Users view communities they have access to" ON public.fb_communities;

CREATE POLICY "Users view communities they have access to"
ON public.fb_communities
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() IS NOT NULL
    AND has_bst_item_access(access_key)
    AND (
      (all_tiers = true AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND lower(coalesce(p.plan_tier, 'open')) IN ('open','pro','vip')
      ))
      OR (all_tiers = false AND (
        required_tier = 'open'
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND (p.plan_tier = fb_communities.required_tier
                 OR tier_rank(p.plan_tier) >= tier_rank(fb_communities.required_tier))
        )
      ))
    )
  )
);

-- quiz_attempts: explicit restrictive deny for UPDATE/DELETE to document intent
DROP POLICY IF EXISTS "Block quiz attempt updates" ON public.quiz_attempts;
CREATE POLICY "Block quiz attempt updates"
ON public.quiz_attempts
AS RESTRICTIVE
FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Block quiz attempt deletes" ON public.quiz_attempts;
CREATE POLICY "Block quiz attempt deletes"
ON public.quiz_attempts
AS RESTRICTIVE
FOR DELETE
USING (false);