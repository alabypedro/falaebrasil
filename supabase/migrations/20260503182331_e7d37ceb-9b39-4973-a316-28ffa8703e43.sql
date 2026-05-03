CREATE OR REPLACE FUNCTION public.get_latest_quiz_attempt(_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _attempt record;
  _passing_score int;
  _total int;
  _correct int := 0;
  _results jsonb := '[]'::jsonb;
  _q record;
  _user_answer int;
  _is_correct boolean;
  _answers jsonb;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _attempt FROM public.quiz_attempts
  WHERE user_id = _user_id AND quiz_id = _quiz_id
  ORDER BY created_at DESC LIMIT 1;

  IF _attempt.id IS NULL THEN RETURN NULL; END IF;

  SELECT passing_score INTO _passing_score FROM public.quizzes WHERE id = _quiz_id;
  SELECT count(*) INTO _total FROM public.quiz_questions WHERE quiz_id = _quiz_id;

  _answers := COALESCE(_attempt.answers, '{}'::jsonb);

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
      'user_answer', _user_answer,
      'correct', _is_correct,
      'correct_option_index', CASE WHEN _is_correct THEN _q.correct_option_index ELSE NULL END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'score', _attempt.score,
    'passed', _attempt.passed,
    'correct_count', _correct,
    'total', _total,
    'answers', _answers,
    'results', _results
  );
END;
$$;