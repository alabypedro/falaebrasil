ALTER TABLE public.profiles
ADD COLUMN best_listening_score NUMERIC DEFAULT 0,
ADD COLUMN best_writing_score NUMERIC DEFAULT 0;
