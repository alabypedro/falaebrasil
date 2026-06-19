DROP POLICY IF EXISTS "Users view library items they have access to" ON public.library_bst;

DROP POLICY IF EXISTS "Authenticated can view library list" ON public.library_bst;
CREATE POLICY "Authenticated can view library list"
  ON public.library_bst
  FOR SELECT
  TO authenticated
  USING (true);