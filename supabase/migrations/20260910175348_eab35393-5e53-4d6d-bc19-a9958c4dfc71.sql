ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS book_text_id uuid REFERENCES public.book_texts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS quizzes_book_text_id_idx ON public.quizzes(book_text_id);

DROP POLICY IF EXISTS "View quizzes with course or bst access" ON public.quizzes;
CREATE POLICY "View quizzes with course or bst access"
ON public.quizzes FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((bst_product_id IS NOT NULL) AND has_bst_product_access(bst_product_id))
  OR ((book_text_id IS NOT NULL) AND (auth.uid() IS NOT NULL))
  OR ((lesson_id IS NOT NULL) AND (EXISTS (
    SELECT 1 FROM lessons l JOIN modules m ON m.id = l.module_id
    WHERE l.id = quizzes.lesson_id AND has_course_access(m.course_id)
  )))
);