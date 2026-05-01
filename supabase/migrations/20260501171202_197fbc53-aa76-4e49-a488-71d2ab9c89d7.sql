
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tutorials_slug_key ON public.tutorials(slug) WHERE slug IS NOT NULL;
