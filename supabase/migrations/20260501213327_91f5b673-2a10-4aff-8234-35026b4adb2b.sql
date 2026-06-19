DROP POLICY IF EXISTS "Authenticated can view library items list" ON public.library_bst;
CREATE POLICY "Authenticated can view library items list"
ON public.library_bst
FOR SELECT
TO authenticated
USING (true);