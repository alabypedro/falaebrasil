-- 1. Catálogo de categorias
CREATE TABLE public.student_category_defs (
  code text PRIMARY KEY,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('open','bst')),
  bst_product_id uuid REFERENCES public.bst_products(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_category_defs TO authenticated;
GRANT ALL ON public.student_category_defs TO service_role;
ALTER TABLE public.student_category_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read category defs" ON public.student_category_defs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage category defs" ON public.student_category_defs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.student_category_defs TO authenticated;

INSERT INTO public.student_category_defs (code, label, kind, bst_product_id, display_order)
VALUES
  ('open', 'Aluno OPEN', 'open', NULL, 0),
  ('bst1', 'Aluno BST1', 'bst', '0e14c259-7698-4878-8568-455ffa1fb943', 1);

-- 2. Categorias por aluno
CREATE TABLE public.student_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL REFERENCES public.student_category_defs(code) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
CREATE INDEX student_categories_user_idx ON public.student_categories(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_categories TO authenticated;
GRANT ALL ON public.student_categories TO service_role;
ALTER TABLE public.student_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own categories" ON public.student_categories
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage student categories" ON public.student_categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER student_categories_updated_at BEFORE UPDATE ON public.student_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Backfill: alunos antigos = OPEN; contas já restritas ao BST mantêm restrição
INSERT INTO public.student_categories (user_id, code, source)
SELECT p.user_id, 'open', 'backfill'
FROM public.profiles p
WHERE lower(COALESCE(p.plan_tier, '')) <> 'bst' OR COALESCE(p.has_course_access, false)
ON CONFLICT DO NOTHING;

INSERT INTO public.student_categories (user_id, code, source)
SELECT DISTINCT p.user_id, d.code, 'backfill'
FROM public.profiles p
JOIN public.bst_product_access a ON a.user_id = p.user_id
JOIN public.student_category_defs d ON d.bst_product_id = a.product_id
WHERE lower(COALESCE(p.plan_tier, '')) = 'bst' AND NOT COALESCE(p.has_course_access, false)
ON CONFLICT DO NOTHING;

-- 4. Produto -> categoria concedida
ALTER TABLE public.payment_products
  ADD COLUMN grants_category text REFERENCES public.student_category_defs(code) ON DELETE SET NULL;
UPDATE public.payment_products SET grants_category = 'open' WHERE product_key = 'plano_open';
UPDATE public.payment_products SET grants_category = 'bst1' WHERE product_key = 'bst1';

-- 5. Flag do vídeo de boas-vindas BST
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_seen_bst_tutorial boolean NOT NULL DEFAULT false;

-- 6. Helper: aluno restrito (tem categoria BST e não tem OPEN)
CREATE OR REPLACE FUNCTION public.is_bst_restricted(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_categories sc
    JOIN public.student_category_defs d ON d.code = sc.code
    WHERE sc.user_id = _user_id AND d.kind = 'bst'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.student_categories sc
    JOIN public.student_category_defs d ON d.code = sc.code
    WHERE sc.user_id = _user_id AND d.kind = 'open'
  )
$$;

-- 7. Admins podem listar alunos
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Checkout aplica a categoria
CREATE OR REPLACE FUNCTION public.apply_student_category(_user_id uuid, _code text, _source text DEFAULT 'asaas')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _kind text;
BEGIN
  IF _code IS NULL THEN RETURN; END IF;
  SELECT kind INTO _kind FROM public.student_category_defs WHERE code = _code;
  IF _kind IS NULL THEN RETURN; END IF;

  INSERT INTO public.student_categories (user_id, code, source)
  VALUES (_user_id, _code, _source)
  ON CONFLICT (user_id, code) DO NOTHING;

  -- OPEN libera tudo: não coexiste com categorias BST
  IF _kind = 'open' THEN
    DELETE FROM public.student_categories sc
    USING public.student_category_defs d
    WHERE sc.code = d.code AND sc.user_id = _user_id AND d.kind = 'bst';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_student_category(uuid, text, text) FROM anon, authenticated;