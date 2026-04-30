
CREATE OR REPLACE FUNCTION public.uncomplete_video(_video_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _xp_per_video int := 25;
  _existed boolean := false;
  _new_xp int;
  _new_level text;
  _deleted int;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_video_progress
  WHERE user_id = _user_id AND video_id = _video_id;

  GET DIAGNOSTICS _deleted = ROW_COUNT;
  _existed := _deleted > 0;

  IF _existed THEN
    UPDATE public.profiles
    SET xp = GREATEST(COALESCE(xp,0) - _xp_per_video, 0),
        level = public.calculate_level_from_xp(GREATEST(COALESCE(xp,0) - _xp_per_video, 0))
    WHERE user_id = _user_id
    RETURNING xp, level INTO _new_xp, _new_level;
  ELSE
    SELECT xp, level INTO _new_xp, _new_level FROM public.profiles WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'removed', _existed,
    'xp_deducted', CASE WHEN _existed THEN _xp_per_video ELSE 0 END,
    'xp', _new_xp,
    'level', _new_level
  );
END;
$$;
