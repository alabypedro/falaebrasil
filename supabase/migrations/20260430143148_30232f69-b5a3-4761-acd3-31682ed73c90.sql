-- 1) Criar visão segura que mascara file_url/audio_url quando não há acesso.
DROP VIEW IF EXISTS public.library_bst_safe;

CREATE VIEW public.library_bst_safe
WITH (security_invoker = on) AS
SELECT
  id,
  title,
  type,
  access_key,
  CASE
    WHEN public.has_bst_item_access(access_key) THEN file_url
    ELSE NULL
  END AS file_url,
  CASE
    WHEN public.has_bst_item_access(access_key) THEN audio_url
    ELSE NULL
  END AS audio_url,
  created_at
FROM public.library_bst;

GRANT SELECT ON public.library_bst_safe TO authenticated;

-- 2) Restringir acesso direto à tabela base: apenas admins podem fazer SELECT direto.
DROP POLICY IF EXISTS "Authenticated can view library list" ON public.library_bst;

CREATE POLICY "Admins can view library_bst raw"
  ON public.library_bst
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));