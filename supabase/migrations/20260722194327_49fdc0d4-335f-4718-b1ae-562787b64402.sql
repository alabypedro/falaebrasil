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
      'correct_option_index', _q.correct_option_index
    );
  END LOOP;

  _score := round((_correct::numeric / _total::numeric) * 100);
  _passed := _score >= _passing_score;

  DELETE FROM public.quiz_attempts WHERE user_id = _user_id AND quiz_id = _quiz_id;

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