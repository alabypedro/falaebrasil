ALTER TABLE public.leiae_texts ADD COLUMN IF NOT EXISTS unit integer;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS unit integer;

CREATE TABLE IF NOT EXISTS public.bst_product_pdfs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bst_product_id uuid NOT NULL REFERENCES public.bst_products(id) ON DELETE CASCADE,
  level text NOT NULL,
  unit integer NOT NULL,
  title text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bst_product_id, level, unit)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bst_product_pdfs TO authenticated;
GRANT ALL ON public.bst_product_pdfs TO service_role;

ALTER TABLE public.bst_product_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alunos com acesso veem os PDFs do produto"
ON public.bst_product_pdfs FOR SELECT TO authenticated
USING (public.has_bst_product_access(bst_product_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam PDFs BST"
ON public.bst_product_pdfs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_bst_product_pdfs_updated_at
BEFORE UPDATE ON public.bst_product_pdfs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();