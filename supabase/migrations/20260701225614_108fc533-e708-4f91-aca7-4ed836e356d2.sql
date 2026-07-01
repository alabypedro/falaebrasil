
CREATE POLICY "Public can read memorizae-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'memorizae-assets');

CREATE POLICY "Admins can upload memorizae-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'memorizae-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update memorizae-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'memorizae-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete memorizae-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'memorizae-assets' AND public.has_role(auth.uid(), 'admin'));
