
-- 1. Restrict profiles INSERT/UPDATE policies to authenticated role only
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Fix submit_quiz to prevent answer farming:
--    a) Only return correct_option_index for questions answered correctly (or already passed)
--    b) Award XP only on the FIRST passing attempt per (user, quiz)
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
  _results jsonb := '[]'::jsonb;
  _q record;
  _user_answer int;
  _is_correct boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT passing_score INTO _passing_score
  FROM public.quizzes WHERE id = _quiz_id;

  IF _passing_score IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  SELECT count(*) INTO _total
  FROM public.quiz_questions WHERE quiz_id = _quiz_id;

  IF _total = 0 THEN
    RAISE EXCEPTION 'Quiz has no questions';
  END IF;

  -- Check if user has already passed this quiz (to prevent XP farming)
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE user_id = _user_id AND quiz_id = _quiz_id AND passed = true
  ) INTO _already_passed;

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

    IF _is_correct THEN
      _correct := _correct + 1;
      -- Only reveal correct_option_index for correct answers (no farming)
      _results := _results || jsonb_build_object(
        'question_id', _q.id,
        'correct', true,
        'correct_option_index', _q.correct_option_index
      );
    ELSE
      -- Hide correct_option_index on wrong answers to prevent answer farming
      _results := _results || jsonb_build_object(
        'question_id', _q.id,
        'correct', false,
        'correct_option_index', null
      );
    END IF;
  END LOOP;

  _score := round((_correct::numeric / _total::numeric) * 100);
  _passed := _score >= _passing_score;

  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (_user_id, _quiz_id, _score, _passed, COALESCE(_answers, '{}'::jsonb));

  -- Only award XP on the FIRST passing attempt
  IF _passed AND NOT _already_passed THEN
    _xp_earned := round(_score::numeric / 10) * 5;
    SELECT xp INTO _current_xp FROM public.profiles WHERE user_id = _user_id;
    _new_xp := COALESCE(_current_xp, 0) + _xp_earned;
    IF _new_xp >= 5000 THEN _new_level := 'B2';
    ELSIF _new_xp >= 2500 THEN _new_level := 'B1';
    ELSIF _new_xp >= 1000 THEN _new_level := 'A2';
    ELSE _new_level := 'A1';
    END IF;
    UPDATE public.profiles
    SET xp = _new_xp, level = _new_level
    WHERE user_id = _user_id;
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

-- 3. Restrict listing on public buckets (avatars, lesson-files).
-- Direct file access via public URL still works; only LIST via storage.objects SELECT is blocked.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Lesson files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can list avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can list lesson-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list lesson-files" ON storage.objects;

-- Only authenticated users can list/select objects metadata in these buckets.
-- Direct CDN/public URL access remains functional independent of these policies.
CREATE POLICY "Authenticated can list avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated can list lesson-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-files');
