-- 1) BST PRODUCTS
CREATE TABLE public.bst_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  pdf_url text,
  secondary_tool text NOT NULL DEFAULT 'falae' CHECK (secondary_tool IN ('falae','leiae')),
  checkout_url text,
  price_cents int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bst_products TO authenticated;
GRANT ALL ON public.bst_products TO service_role;
ALTER TABLE public.bst_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view active bst products" ON public.bst_products
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage bst products" ON public.bst_products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_bst_products_updated BEFORE UPDATE ON public.bst_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) ACCESS
CREATE TABLE public.bst_product_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.bst_products(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'admin',
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT ON public.bst_product_access TO authenticated;
GRANT ALL ON public.bst_product_access TO service_role;
ALTER TABLE public.bst_product_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bst access" ON public.bst_product_access
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage bst access" ON public.bst_product_access
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_bst_product_access_updated BEFORE UPDATE ON public.bst_product_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) ACCESS FUNCTION
CREATE OR REPLACE FUNCTION public.has_bst_product_access(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.has_course_access = true
    )
    OR EXISTS (
      SELECT 1 FROM public.bst_product_access a
      WHERE a.user_id = auth.uid() AND a.product_id = _product_id
    )
$$;

-- 4) LINK EXISTING AI CONTENT TO BST PRODUCTS
ALTER TABLE public.memorize_decks ADD COLUMN IF NOT EXISTS bst_product_id uuid REFERENCES public.bst_products(id) ON DELETE CASCADE;
ALTER TABLE public.leiae_texts ADD COLUMN IF NOT EXISTS bst_product_id uuid REFERENCES public.bst_products(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_memorize_decks_bst ON public.memorize_decks(bst_product_id);
CREATE INDEX IF NOT EXISTS idx_leiae_texts_bst ON public.leiae_texts(bst_product_id);

DROP POLICY IF EXISTS "View memorize decks with course access" ON public.memorize_decks;
CREATE POLICY "View memorize decks with course access" ON public.memorize_decks
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR (bst_product_id IS NOT NULL AND public.has_bst_product_access(bst_product_id))
    OR (bst_product_id IS NULL AND (course_id IS NULL OR public.has_course_access(course_id)))
  );

DROP POLICY IF EXISTS "View memorize cards with deck access" ON public.memorize_cards;
CREATE POLICY "View memorize cards with deck access" ON public.memorize_cards
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.memorize_decks d
      WHERE d.id = memorize_cards.deck_id
        AND (
          (d.bst_product_id IS NOT NULL AND public.has_bst_product_access(d.bst_product_id))
          OR (d.bst_product_id IS NULL AND (d.course_id IS NULL OR public.has_course_access(d.course_id)))
        )
    )
  );

DROP POLICY IF EXISTS "View leiae texts with course access" ON public.leiae_texts;
CREATE POLICY "View leiae texts with course access" ON public.leiae_texts
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR (bst_product_id IS NOT NULL AND public.has_bst_product_access(bst_product_id))
    OR (bst_product_id IS NULL AND (course_id IS NULL OR public.has_course_access(course_id)))
  );

-- 5) BST VOICE SCRIPTS (IA Falae scripted, BST only)
CREATE TABLE public.bst_voice_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bst_product_id uuid NOT NULL REFERENCES public.bst_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  script_text text NOT NULL,
  level text NOT NULL DEFAULT 'A1' CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bst_voice_scripts TO authenticated;
GRANT ALL ON public.bst_voice_scripts TO service_role;
ALTER TABLE public.bst_voice_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View bst scripts with product access" ON public.bst_voice_scripts
  FOR SELECT TO authenticated USING (public.has_bst_product_access(bst_product_id));
CREATE POLICY "Admins manage bst scripts" ON public.bst_voice_scripts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_bst_voice_scripts_product ON public.bst_voice_scripts(bst_product_id, display_order);
CREATE TRIGGER trg_bst_voice_scripts_updated BEFORE UPDATE ON public.bst_voice_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();