CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (webhook / admin functions) to change anything
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Allow trusted SECURITY DEFINER routines to update system-managed fields.
  -- End users cannot set this through normal profile updates.
  IF current_setting('app.bypass_profile_protection', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- For end users, freeze access / billing / credit / XP fields
  IF NEW.has_course_access IS DISTINCT FROM OLD.has_course_access
     OR NEW.has_ebook1_access IS DISTINCT FROM OLD.has_ebook1_access
     OR NEW.has_ebook2_access IS DISTINCT FROM OLD.has_ebook2_access
     OR NEW.has_ebook3_access IS DISTINCT FROM OLD.has_ebook3_access
     OR NEW.scripted_balance IS DISTINCT FROM OLD.scripted_balance
     OR NEW.unscripted_balance IS DISTINCT FROM OLD.unscripted_balance
     OR NEW.hubla_customer_id IS DISTINCT FROM OLD.hubla_customer_id
     OR NEW.xp IS DISTINCT FROM OLD.xp
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

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
    PERFORM set_config('app.bypass_profile_protection', 'on', true);

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

CREATE OR REPLACE FUNCTION public.uncomplete_video(_video_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    PERFORM set_config('app.bypass_profile_protection', 'on', true);

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
$function$;

CREATE OR REPLACE FUNCTION public.sync_xp_on_lesson_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _xp_delta int := 25;
  _new_xp int;
BEGIN
  PERFORM set_config('app.bypass_profile_protection', 'on', true);

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
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz(_quiz_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _passing_score int;
  _total int;
  _correct int := 0;
  _score int;
  _passed boolean;
  _xp_earned int := 0;
  _new_xp int;
  _new_level text;
  _current_xp int;
  _already_passed boolean := false;
  _best_correct int := 0;
  _best_score int := 0;
  _delta_correct int := 0;
  _results jsonb := '[]'::jsonb;
  _q record;
  _user_answer int;
  _is_correct boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT passing_score INTO _passing_score FROM public.quizzes WHERE id = _quiz_id;
  IF _passing_score IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;

  SELECT count(*) INTO _total FROM public.quiz_questions WHERE quiz_id = _quiz_id;
  IF _total = 0 THEN RAISE EXCEPTION 'Quiz has no questions'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE user_id = _user_id AND quiz_id = _quiz_id AND passed = true
  ) INTO _already_passed;

  SELECT COALESCE(MAX(score), 0) INTO _best_score
  FROM public.quiz_attempts
  WHERE user_id = _user_id AND quiz_id = _quiz_id;
  _best_correct := round((_best_score::numeric / 100) * _total);

  FOR _q IN
    SELECT id, correct_option_index, display_order
    FROM public.quiz_questions
    WHERE quiz_id = _quiz_id
    ORDER BY display_order
  LOOP
    _user_answer := NULLIF(_answers ->> _q.id::text, '')::int;
    IF _user_answer IS NULL THEN
      _user_answer := NULLIF(_answers ->> _q.display_order::text, '')::int;
    END IF;
    _is_correct := _user_answer IS NOT NULL AND _user_answer = _q.correct_option_index;
    IF _is_correct THEN _correct := _correct + 1; END IF;
    _results := _results || jsonb_build_object(
      'question_id', _q.id,
      'correct', _is_correct,
      'correct_option_index', CASE WHEN _is_correct THEN _q.correct_option_index ELSE NULL END
    );
  END LOOP;

  _score := round((_correct::numeric / _total::numeric) * 100);
  _passed := _score >= _passing_score;

  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (_user_id, _quiz_id, _score, _passed, COALESCE(_answers, '{}'::jsonb));

  IF _passed AND NOT _already_passed THEN
    _xp_earned := (_correct * 5) + 25;
  ELSIF _passed AND _already_passed AND _correct > _best_correct THEN
    _delta_correct := _correct - _best_correct;
    _xp_earned := _delta_correct * 5;
    IF _score = 100 AND _best_score < 100 THEN
      _xp_earned := _xp_earned + 25;
    END IF;
  END IF;

  IF _xp_earned > 0 THEN
    SELECT xp INTO _current_xp FROM public.profiles WHERE user_id = _user_id;
    _new_xp := COALESCE(_current_xp, 0) + _xp_earned;
    _new_level := public.calculate_level_from_xp(_new_xp);
    PERFORM set_config('app.bypass_profile_protection', 'on', true);
    UPDATE public.profiles SET xp = _new_xp, level = _new_level WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'score', _score,
    'passed', _passed,
    'correct_count', _correct,
    'total', _total,
    'xp_earned', _xp_earned,
    'results', _results
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.debit_unscripted_seconds(_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _current integer;
  _to_debit integer;
  _new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _seconds IS NULL OR _seconds <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', NULL);
  END IF;

  SELECT unscripted_balance INTO _current FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF _current IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF _current <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', 0, 'insufficient', true);
  END IF;

  _to_debit := LEAST(_seconds, _current);
  _new_balance := _current - _to_debit;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  UPDATE public.profiles SET unscripted_balance = _new_balance WHERE user_id = _user_id;

  RETURN jsonb_build_object('debited', _to_debit, 'balance', _new_balance, 'insufficient', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.debit_scripted_seconds(_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _current integer;
  _to_debit integer;
  _new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _seconds IS NULL OR _seconds <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', NULL);
  END IF;

  SELECT scripted_balance INTO _current FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF _current IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF _current <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', 0, 'insufficient', true);
  END IF;

  _to_debit := LEAST(_seconds, _current);
  _new_balance := _current - _to_debit;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  UPDATE public.profiles SET scripted_balance = _new_balance WHERE user_id = _user_id;

  RETURN jsonb_build_object('debited', _to_debit, 'balance', _new_balance, 'insufficient', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_all_progress()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_progress WHERE user_id = _user_id;
  DELETE FROM public.quiz_attempts WHERE user_id = _user_id;
  DELETE FROM public.user_video_progress WHERE user_id = _user_id;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  UPDATE public.profiles
  SET xp = 0, level = 'A1', streak_days = 0
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;