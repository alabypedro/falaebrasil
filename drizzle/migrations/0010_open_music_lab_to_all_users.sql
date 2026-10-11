CREATE OR REPLACE FUNCTION public.has_music_lab_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Cantaê liberado para todo usuário autenticado, independente de plano ou produto
  SELECT _user_id IS NOT NULL
$$;