-- Permitir acesso público de leitura ao bucket lesson-files
DROP POLICY IF EXISTS "Public Access for lesson-files" ON storage.objects;
CREATE POLICY "Public Access for lesson-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-files');

-- Garantir que administradores podem fazer upload na pasta listening do bucket lesson-files
-- (A política geral para lesson-files já existe, mas vamos reforçar se necessário)
-- Já existe: "Admins can upload lesson files"
