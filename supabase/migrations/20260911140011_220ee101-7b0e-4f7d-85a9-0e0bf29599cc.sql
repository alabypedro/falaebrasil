ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_levels text[],
  ADD COLUMN IF NOT EXISTS has_books_access boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.allowed_levels IS 'Níveis visíveis para o aluno (A1..C2, K1..K4, T1..T4). NULL ou vazio = todos os níveis.';