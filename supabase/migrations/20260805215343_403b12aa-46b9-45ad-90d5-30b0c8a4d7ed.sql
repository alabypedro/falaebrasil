CREATE POLICY "Alunos leem seus relatorios de avaliacao"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'evaluation-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Alunos enviam seus relatorios de avaliacao"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evaluation-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Alunos atualizam seus relatorios de avaliacao"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'evaluation-reports' AND (storage.foldername(name))[1] = auth.uid()::text);