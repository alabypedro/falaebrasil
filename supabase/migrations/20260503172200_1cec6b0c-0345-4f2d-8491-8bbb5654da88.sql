CREATE OR REPLACE FUNCTION public.complete_video(_video_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _xp_per_video int := 25;
  _inserted_count int := 0;
  _was_new boolean := false;
  _new_xp int;
  _new_level text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_video_progress (user_id, video_id)
  VALUES (_user_id, _video_id)
  ON CONFLICT (user_id, video_id) DO NOTHING;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  _was_new := _inserted_count > 0;

  IF _was_new THEN
    UPDATE public.profiles
    SET xp = COALESCE(xp,0) + _xp_per_video,
        level = public.calculate_level_from_xp(COALESCE(xp,0) + _xp_per_video)
    WHERE user_id = _user_id
    RETURNING xp, level INTO _new_xp, _new_level;
  ELSE
    SELECT xp, level INTO _new_xp, _new_level FROM public.profiles WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'awarded', _was_new,
    'xp_earned', CASE WHEN _was_new THEN _xp_per_video ELSE 0 END,
    'xp', _new_xp,
    'level', _new_level
  );
END;
$function$;