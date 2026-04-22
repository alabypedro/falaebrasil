
-- Remove broad SELECT policies on public buckets to prevent listing.
-- Direct public URL downloads still function (they bypass storage.objects RLS via the CDN).
DROP POLICY IF EXISTS "Authenticated can list avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list lesson-files" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Lesson files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read lesson-files" ON storage.objects;
