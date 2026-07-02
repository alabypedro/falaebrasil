
-- Allow authenticated users to read memorizae assets, and admins to manage them.
CREATE POLICY "memorizae-assets read authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'memorizae-assets');

CREATE POLICY "memorizae-assets admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'memorizae-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "memorizae-assets admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'memorizae-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "memorizae-assets admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'memorizae-assets' AND public.has_role(auth.uid(), 'admin'::app_role));
