CREATE OR REPLACE FUNCTION public.reset_all_progress()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete activity records
  DELETE FROM public.user_progress WHERE user_id = _user_id;
  DELETE FROM public.quiz_attempts WHERE user_id = _user_id;
  DELETE FROM public.user_video_progress WHERE user_id = _user_id;
  DELETE FROM public.recordings WHERE user_id = _user_id;

  -- Reset profile stats including voice scores
  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  UPDATE public.profiles
  SET 
    xp = 0, 
    level = 'A1', 
    streak_days = 0,
    best_scripted_score = 0,
    best_unscripted_score = 0
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;