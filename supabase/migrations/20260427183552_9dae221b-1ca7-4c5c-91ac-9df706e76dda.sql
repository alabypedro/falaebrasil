-- 1. Function to recalculate level from XP
CREATE OR REPLACE FUNCTION public.calculate_level_from_xp(_xp integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _xp >= 5000 THEN 'B2'
    WHEN _xp >= 2500 THEN 'B1'
    WHEN _xp >= 1000 THEN 'A2'
    ELSE 'A1'
  END
$$;

-- 2. Trigger function: sync XP on user_progress insert/delete
CREATE OR REPLACE FUNCTION public.sync_xp_on_lesson_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _xp_delta int := 25;
  _new_xp int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET xp = GREATEST(0, xp + _xp_delta),
        level = public.calculate_level_from_xp(GREATEST(0, xp + _xp_delta))
    WHERE user_id = NEW.user_id
    RETURNING xp INTO _new_xp;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET xp = GREATEST(0, xp - _xp_delta),
        level = public.calculate_level_from_xp(GREATEST(0, xp - _xp_delta))
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_xp_on_lesson_progress_ins ON public.user_progress;
DROP TRIGGER IF EXISTS trg_sync_xp_on_lesson_progress_del ON public.user_progress;

CREATE OR REPLACE TRIGGER trg_sync_xp_on_lesson_progress_ins
AFTER INSERT ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_xp_on_lesson_progress();

CREATE OR REPLACE TRIGGER trg_sync_xp_on_lesson_progress_del
AFTER DELETE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_xp_on_lesson_progress();

-- 3. Reset progress for a specific course (deletes user_progress for all lessons in that course; trigger handles XP)
CREATE OR REPLACE FUNCTION public.reset_course_progress(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _deleted int;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH del AS (
    DELETE FROM public.user_progress
    WHERE user_id = _user_id
      AND lesson_id IN (
        SELECT l.id FROM public.lessons l
        JOIN public.modules m ON m.id = l.module_id
        WHERE m.course_id = _course_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM del;

  RETURN jsonb_build_object('deleted', _deleted);
END;
$$;

-- 4. Reset ALL progress for current user
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

  -- Delete all lesson progress (trigger would adjust XP, but we'll override below)
  DELETE FROM public.user_progress WHERE user_id = _user_id;
  DELETE FROM public.quiz_attempts WHERE user_id = _user_id;

  -- Force reset profile to baseline
  UPDATE public.profiles
  SET xp = 0, level = 'A1', streak_days = 0
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;