-- 1) memorizae-assets: remove broad read policies, scope to deck/card access
DROP POLICY IF EXISTS "Public can read memorizae-assets" ON storage.objects;
DROP POLICY IF EXISTS "memorizae-assets read authenticated" ON storage.objects;

CREATE POLICY "memorizae-assets read with card access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'memorizae-assets'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.memorize_cards c
      JOIN public.memorize_decks d ON d.id = c.deck_id
      WHERE (
        c.image_url = storage.objects.name
        OR c.audio_url = storage.objects.name
        OR c.image_url LIKE '%' || storage.objects.name
        OR c.audio_url LIKE '%' || storage.objects.name
      )
      AND (
        (d.bst_product_id IS NOT NULL AND public.has_bst_product_access(d.bst_product_id))
        OR (d.bst_product_id IS NULL AND (d.course_id IS NULL OR public.has_course_access(d.course_id)))
      )
    )
  )
);

-- 2) listening-images: no lesson references this bucket anymore; restrict reads to admins
DROP POLICY IF EXISTS "Imagens do Escutaê são públicas" ON storage.objects;

CREATE POLICY "listening-images admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'listening-images'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);