-- 1. Add access flags to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_course_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ebook1_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ebook2_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ebook3_access boolean NOT NULL DEFAULT false;

-- 2. Add access_key to library_bst
ALTER TABLE public.library_bst
  ADD COLUMN IF NOT EXISTS access_key text NOT NULL DEFAULT 'free'
    CHECK (access_key IN ('free', 'ebook1', 'ebook2', 'ebook3'));

-- 3. Create hubla_product_mapping table
CREATE TABLE IF NOT EXISTS public.hubla_product_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_key text NOT NULL UNIQUE
    CHECK (product_key IN ('essencial_pro_a1', 'ebook1', 'ebook2', 'ebook3')),
  display_name text NOT NULL,
  hubla_product_id text,
  hubla_product_name text,
  checkout_url text,
  price_cents integer NOT NULL DEFAULT 0,
  grants_course boolean NOT NULL DEFAULT false,
  grants_ebook1 boolean NOT NULL DEFAULT false,
  grants_ebook2 boolean NOT NULL DEFAULT false,
  grants_ebook3 boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hubla_product_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage product mapping" ON public.hubla_product_mapping;
  CREATE POLICY "Admins can manage product mapping"
  ON public.hubla_product_mapping
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view product mapping" ON public.hubla_product_mapping;
  CREATE POLICY "Authenticated can view product mapping"
  ON public.hubla_product_mapping
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE TRIGGER update_hubla_product_mapping_updated_at
  BEFORE UPDATE ON public.hubla_product_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-populate with empty rows
INSERT INTO public.hubla_product_mapping (product_key, display_name, price_cents, grants_course, grants_ebook1, grants_ebook2, grants_ebook3)
VALUES
  ('essencial_pro_a1', 'Essencial Pro A1', 4800, true, false, false, false),
  ('ebook1', 'Anfitrião Soberano', 2400, false, true, false, false),
  ('ebook2', 'Decodificador de Gringo', 1600, false, false, true, false),
  ('ebook3', 'Vocabulário de Poder', 800, false, false, false, true)
ON CONFLICT (product_key) DO NOTHING;

-- 4. Hide non-A1 courses from regular users
DROP POLICY IF EXISTS "Anyone authenticated can view published courses" ON public.courses;

CREATE POLICY "Users view published A1 or admins view all"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (published = true AND upper(level) = 'A1')
  );

-- 5. Library BST gating helper function
CREATE OR REPLACE FUNCTION public.has_bst_item_access(_access_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR _access_key = 'free'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          (_access_key = 'ebook1' AND p.has_ebook1_access = true)
          OR (_access_key = 'ebook2' AND p.has_ebook2_access = true)
          OR (_access_key = 'ebook3' AND p.has_ebook3_access = true)
        )
    )
$$;

-- Update library_bst SELECT policy to gate by access_key
DROP POLICY IF EXISTS "Anyone authenticated can view library" ON public.library_bst;

CREATE POLICY "Users view library items they have access to"
  ON public.library_bst
  FOR SELECT
  TO authenticated
  USING (public.has_bst_item_access(access_key));