CREATE OR REPLACE FUNCTION public.has_bst_product_access(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_open_category(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.bst_product_access a
      WHERE a.user_id = auth.uid()
        AND a.product_id = _product_id
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_quiz(_quiz_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = _quiz_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (q.bst_product_id IS NOT NULL AND public.has_bst_product_access(q.bst_product_id))
        OR (
          q.book_text_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.book_texts bt
            WHERE bt.id = q.book_text_id
              AND (
                public.has_open_category(auth.uid())
                OR public.has_role(auth.uid(), 'teacher'::app_role)
              )
          )
        )
        OR (
          q.lesson_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.lessons l
            JOIN public.modules m ON m.id = l.module_id
            WHERE l.id = q.lesson_id
              AND public.has_course_access(m.course_id)
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_quiz(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_quiz(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.quiz_questions_public
WITH (security_invoker = false)
AS
SELECT qq.id, qq.quiz_id, qq.question_text, qq.options, qq.display_order, qq.created_at
FROM public.quiz_questions qq
WHERE public.can_access_quiz(qq.quiz_id);

REVOKE ALL ON public.quiz_questions_public FROM PUBLIC, anon;
GRANT SELECT ON public.quiz_questions_public TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_quiz_attempt_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_quiz(NEW.quiz_id) THEN
    RAISE EXCEPTION 'Quiz access denied';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quiz_attempt_access_trigger ON public.quiz_attempts;
CREATE TRIGGER enforce_quiz_attempt_access_trigger
BEFORE INSERT OR UPDATE OF quiz_id ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.enforce_quiz_attempt_access();

CREATE OR REPLACE FUNCTION public.validate_payment_bundle_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _parent_category text;
  _included_category text;
BEGIN
  SELECT grants_category INTO _parent_category
  FROM public.payment_products
  WHERE id = NEW.product_id;

  SELECT grants_category INTO _included_category
  FROM public.payment_products
  WHERE id = NEW.included_product_id;

  IF lower(coalesce(_included_category, '')) = 'open'
     AND lower(coalesce(_parent_category, '')) <> 'open' THEN
    RAISE EXCEPTION 'OPEN products cannot be included in non-OPEN bundles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_payment_bundle_category_trigger ON public.payment_product_bundles;
CREATE TRIGGER validate_payment_bundle_category_trigger
BEFORE INSERT OR UPDATE ON public.payment_product_bundles
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_bundle_category();

CREATE POLICY "Admins can read BST files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bst-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload BST files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bst-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update BST files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bst-files' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'bst-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete BST files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bst-files' AND public.has_role(auth.uid(), 'admin'::app_role));