
-- 1) Replace community-audio read policy with strict path matching + current access check
DROP POLICY IF EXISTS "Users read community audio they have access to" ON storage.objects;

CREATE POLICY "Users read community audio they have access to"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'community-audio'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.community_messages m
      JOIN public.community_channels c ON c.id = m.channel_id
      WHERE m.audio_url LIKE '%/community-audio/' || storage.objects.name
        AND public.can_access_level(c.level)
    )
  )
);

-- 2) Block direct inserts to quiz_attempts. submit_quiz() is SECURITY DEFINER and runs as
-- the function owner (postgres), which bypasses RLS, so legitimate grading still works.
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.quiz_attempts;

DROP POLICY IF EXISTS "Block direct quiz attempt inserts" ON public.quiz_attempts;
CREATE POLICY "Block direct quiz attempt inserts"
ON public.quiz_attempts
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);
