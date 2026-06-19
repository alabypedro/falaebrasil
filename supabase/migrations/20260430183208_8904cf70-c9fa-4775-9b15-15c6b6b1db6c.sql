
-- Track per-video completion
CREATE TABLE IF NOT EXISTS public.user_video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.lesson_videos(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own video progress" ON public.user_video_progress;
  CREATE POLICY "Users view own video progress"
  ON public.user_video_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own video progress" ON public.user_video_progress;
  CREATE POLICY "Users insert own video progress"
  ON public.user_video_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own video progress" ON public.user_video_progress;
  CREATE POLICY "Users delete own video progress"
  ON public.user_video_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_video_progress_user ON public.user_video_progress(user_id);

-- RPC: mark video complete and award XP (25 XP, only first time)
CREATE OR REPLACE FUNCTION public.complete_video(_video_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _xp_per_video int := 25;
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

  GET DIAGNOSTICS _was_new = ROW_COUNT;

  IF _was_new THEN
    UPDATE public.profiles
    SET xp = COALESCE(xp,0) + _xp_per_video,
        level = public.calculate_level_from_xp(COALESCE(xp,0) + _xp_per_video)
    WHERE user_id = _user_id
    RETURNING xp INTO _new_xp;
    _new_level := public.calculate_level_from_xp(_new_xp);
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
$$;
