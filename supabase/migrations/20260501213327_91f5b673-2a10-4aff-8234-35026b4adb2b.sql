CREATE POLICY "Authenticated can view library items list"
ON public.library_bst
FOR SELECT
TO authenticated
USING (true);