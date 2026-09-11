DROP POLICY IF EXISTS "View quizzes with course or bst access" ON public.quizzes;

CREATE POLICY "View quizzes with course or bst access"
ON public.quizzes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (bst_product_id IS NOT NULL AND has_bst_product_access(bst_product_id))
  OR (
    book_text_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.book_texts bt
      WHERE bt.id = quizzes.book_text_id
        AND (
          has_open_category(auth.uid())
          OR has_role(auth.uid(), 'teacher'::app_role)
        )
    )
  )
  OR (
    lesson_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.id = quizzes.lesson_id AND has_course_access(m.course_id)
    )
  )
);