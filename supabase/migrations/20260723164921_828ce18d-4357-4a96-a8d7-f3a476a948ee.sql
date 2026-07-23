CREATE OR REPLACE FUNCTION public.update_best_score(_kind text, _value numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _value IS NULL OR _value < 0 OR _value > 100 THEN RAISE EXCEPTION 'invalid score'; END IF;

  IF _kind = 'scripted' THEN
    UPDATE public.profiles SET best_scripted_score = GREATEST(COALESCE(best_scripted_score,0), _value)
      WHERE user_id = _uid RETURNING best_scripted_score INTO _new;
  ELSIF _kind = 'unscripted' THEN
    UPDATE public.profiles SET best_unscripted_score = GREATEST(COALESCE(best_unscripted_score,0), _value)
      WHERE user_id = _uid RETURNING best_unscripted_score INTO _new;
  ELSIF _kind = 'listening' THEN
    UPDATE public.profiles SET best_listening_score = GREATEST(COALESCE(best_listening_score,0), _value)
      WHERE user_id = _uid RETURNING best_listening_score INTO _new;
  ELSIF _kind = 'writing' THEN
    UPDATE public.profiles SET best_writing_score = GREATEST(COALESCE(best_writing_score,0), _value)
      WHERE user_id = _uid RETURNING best_writing_score INTO _new;
  ELSE
    RAISE EXCEPTION 'invalid kind';
  END IF;

  RETURN _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_best_score(text, numeric) TO authenticated;