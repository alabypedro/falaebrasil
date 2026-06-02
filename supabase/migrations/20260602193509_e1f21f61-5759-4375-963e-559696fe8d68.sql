-- Permissões para o bucket listening-images
CREATE POLICY "Imagens do Escutaê são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'listening-images');

CREATE POLICY "Admins podem fazer upload de imagens do Escutaê"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'listening-images' 
    AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Admins podem atualizar imagens do Escutaê"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'listening-images' 
    AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Admins podem deletar imagens do Escutaê"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'listening-images' 
    AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
);