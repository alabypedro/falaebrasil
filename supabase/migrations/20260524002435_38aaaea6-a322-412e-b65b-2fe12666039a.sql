UPDATE storage.buckets SET public = false WHERE id = 'contracts';
DROP POLICY IF EXISTS "Public can read contracts" ON storage.objects;
CREATE POLICY "Authenticated can read contracts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contracts');