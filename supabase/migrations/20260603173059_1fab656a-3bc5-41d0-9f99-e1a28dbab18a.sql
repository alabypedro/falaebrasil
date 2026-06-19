
-- 1) library_bst: replace blanket SELECT with access-key check
DROP POLICY IF EXISTS "Authenticated can view library items list" ON public.library_bst;

DROP POLICY IF EXISTS "Users view library items they have access to" ON public.library_bst;
CREATE POLICY "Users view library items they have access to"
ON public.library_bst
FOR SELECT
TO authenticated
USING (public.has_bst_item_access(access_key));

-- 2) storage: restrict community-audio reads to users with channel access
DROP POLICY IF EXISTS "Authenticated can read community audio" ON storage.objects;

DROP POLICY IF EXISTS "Users read community audio they have access to" ON storage.objects;
CREATE POLICY "Users read community audio they have access to"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'community-audio'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.community_messages m
      JOIN public.community_channels c ON c.id = m.channel_id
      WHERE m.audio_url LIKE '%' || name
        AND public.can_access_level(c.level)
    )
  )
);
