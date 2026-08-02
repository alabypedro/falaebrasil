-- 1) primary_tool on BST products
ALTER TABLE public.bst_products
  ADD COLUMN IF NOT EXISTS primary_tool text NOT NULL DEFAULT 'memorizae';

ALTER TABLE public.bst_products DROP CONSTRAINT IF EXISTS bst_products_primary_tool_check;
ALTER TABLE public.bst_products
  ADD CONSTRAINT bst_products_primary_tool_check CHECK (primary_tool IN ('memorizae','quiz'));

UPDATE public.bst_products
SET primary_tool = 'quiz'
WHERE title ILIKE '%Cartilha de Ingl%s Instrumental do Zero%';

-- 2) quizzes can belong to a BST product instead of a lesson
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS bst_product_id uuid REFERENCES public.bst_products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'A1',
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.quizzes ALTER COLUMN lesson_id DROP NOT NULL;

ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_owner_check;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_owner_check CHECK (lesson_id IS NOT NULL OR bst_product_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS quizzes_bst_product_id_idx ON public.quizzes(bst_product_id);

-- 3) RLS: allow reading BST quizzes with product access
DROP POLICY IF EXISTS "View quizzes with course access" ON public.quizzes;
CREATE POLICY "View quizzes with course or bst access" ON public.quizzes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    quizzes.bst_product_id IS NOT NULL
    AND public.has_bst_product_access(quizzes.bst_product_id)
  )
  OR (
    quizzes.lesson_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.id = quizzes.lesson_id
        AND public.has_course_access(m.course_id)
    )
  )
);