CREATE OR REPLACE FUNCTION public.get_student_performance(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _p record;
  _course_ids uuid[];
  _videos_total int := 0;
  _videos_done int := 0;
  _courses jsonb := '[]'::jsonb;
  _progress jsonb := '[]'::jsonb;
  _quiz_avg numeric;
  _best jsonb;
  _score numeric;
  _components numeric[];
  _recent jsonb := '[]'::jsonb;
  _ai_xp int := 0;
  _completed int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_my_student(_student_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT user_id, display_name, level, xp, plan_tier, created_at, last_activity,
         best_scripted_score, best_unscripted_score, best_listening_score, best_writing_score,
         has_course_access
    INTO _p
  FROM public.profiles WHERE user_id = _student_id;

  IF _p.user_id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;

  SELECT COALESCE(array_agg(DISTINCT course_id), ARRAY[]::uuid[]) INTO _course_ids
  FROM public.user_course_access WHERE user_id = _student_id;

  IF array_length(_course_ids, 1) IS NULL AND COALESCE(_p.has_course_access, false) THEN
    SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO _course_ids
    FROM public.courses c
    WHERE c.published = true
      AND public.tier_rank(_p.plan_tier) >= public.tier_rank(c.required_tier);
  END IF;

  WITH cv AS (
    SELECT c.id AS course_id, c.title, c.level, v.id AS video_id
    FROM public.courses c
    JOIN public.modules m ON m.course_id = c.id
    JOIN public.lessons l ON l.module_id = m.id
    JOIN public.lesson_videos v ON v.lesson_id = l.id
    WHERE c.id = ANY(_course_ids)
  ),
  vp AS (
    SELECT video_id FROM public.user_video_progress WHERE user_id = _student_id
  ),
  cq AS (
    SELECT c.id AS course_id, MAX(qa.score) AS best_quiz
    FROM public.courses c
    JOIN public.modules m ON m.course_id = c.id
    JOIN public.lessons l ON l.module_id = m.id
    JOIN public.quizzes q ON q.lesson_id = l.id
    JOIN public.quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_id = _student_id
    WHERE c.id = ANY(_course_ids)
    GROUP BY c.id
  ),
  agg AS (
    SELECT cv.course_id, cv.title, cv.level,
           count(*) AS total,
           count(vp.video_id) AS done
    FROM cv LEFT JOIN vp ON vp.video_id = cv.video_id
    GROUP BY cv.course_id, cv.title, cv.level
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'course_id', a.course_id,
      'title', a.title,
      'level', a.level,
      'videos_done', a.done,
      'videos_total', a.total,
      'videos_percent', CASE WHEN a.total > 0 THEN round((a.done::numeric / a.total) * 100) ELSE 0 END,
      'best_quiz', cq.best_quiz
    ) ORDER BY a.level, a.title), '[]'::jsonb),
    COALESCE(SUM(a.total), 0),
    COALESCE(SUM(a.done), 0)
  INTO _courses, _videos_total, _videos_done
  FROM agg a LEFT JOIN cq ON cq.course_id = a.course_id;

  -- Progresso por curso: TODOS os cursos publicados com código (A1..C2, T1..T4, K1..K4)
  WITH allc AS (
    SELECT c.id, c.display_order, upper(coalesce(nullif(c.level, ''), substring(c.title from '\m([ABCTK][1-4])\M'))) AS code
    FROM public.courses c
    WHERE c.published = true
  ),
  cv AS (
    SELECT a.id AS course_id, a.code, a.display_order, v.id AS video_id
    FROM allc a
    JOIN public.modules m ON m.course_id = a.id
    JOIN public.lessons l ON l.module_id = m.id
    JOIN public.lesson_videos v ON v.lesson_id = l.id
    WHERE a.code IS NOT NULL
  ),
  vp AS (
    SELECT video_id FROM public.user_video_progress WHERE user_id = _student_id
  ),
  agg AS (
    SELECT cv.code, min(cv.display_order) AS ord, count(*) AS total, count(vp.video_id) AS done
    FROM cv LEFT JOIN vp ON vp.video_id = cv.video_id
    GROUP BY cv.code
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', agg.code,
    'percent', CASE WHEN agg.total > 0 THEN round((agg.done::numeric / agg.total) * 100) ELSE 0 END,
    'videos_done', agg.done,
    'videos_total', agg.total
  ) ORDER BY agg.ord, agg.code), '[]'::jsonb)
  INTO _progress FROM agg;

  -- Média dos quizzes: última tentativa de cada quiz
  SELECT AVG(latest.score) INTO _quiz_avg
  FROM (
    SELECT DISTINCT ON (qa.quiz_id) qa.quiz_id, qa.score
    FROM public.quiz_attempts qa
    WHERE qa.user_id = _student_id
    ORDER BY qa.quiz_id, qa.created_at DESC
  ) latest;

  SELECT jsonb_build_object('score', qa.score, 'quiz_title', q.title, 'level', q.level, 'created_at', qa.created_at)
    INTO _best
  FROM public.quiz_attempts qa
  JOIN public.quizzes q ON q.id = qa.quiz_id
  WHERE qa.user_id = _student_id
  ORDER BY qa.score DESC, qa.created_at DESC
  LIMIT 1;

  _components := ARRAY(
    SELECT x FROM unnest(ARRAY[
      _quiz_avg, _p.best_scripted_score, _p.best_unscripted_score,
      _p.best_listening_score, _p.best_writing_score
    ]) AS x WHERE x IS NOT NULL
  );
  IF array_length(_components, 1) IS NOT NULL THEN
    SELECT AVG(v) INTO _score FROM unnest(_components) AS v;
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO _ai_xp FROM public.ai_xp_events WHERE user_id = _student_id;
  SELECT count(*) INTO _completed FROM public.user_video_progress WHERE user_id = _student_id;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'at') DESC), '[]'::jsonb) INTO _recent
  FROM (
    SELECT jsonb_build_object('type', 'video', 'title', lv.title, 'at', uvp.completed_at, 'score', NULL) AS r
    FROM public.user_video_progress uvp
    JOIN public.lesson_videos lv ON lv.id = uvp.video_id
    WHERE uvp.user_id = _student_id
    ORDER BY uvp.completed_at DESC LIMIT 10
  ) v;

  SELECT _recent || COALESCE(jsonb_agg(r ORDER BY (r->>'at') DESC), '[]'::jsonb) INTO _recent
  FROM (
    SELECT jsonb_build_object('type', 'quiz', 'title', q.title, 'at', qa.created_at, 'score', qa.score) AS r
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.user_id = _student_id
    ORDER BY qa.created_at DESC LIMIT 10
  ) qq;

  RETURN jsonb_build_object(
    'student', jsonb_build_object(
      'user_id', _p.user_id,
      'display_name', _p.display_name,
      'level', _p.level,
      'xp', _p.xp,
      'ai_xp', _ai_xp,
      'total_xp', COALESCE(_p.xp, 0) + _ai_xp,
      'plan_tier', _p.plan_tier,
      'started_at', _p.created_at,
      'last_activity', _p.last_activity
    ),
    'videos', jsonb_build_object(
      'done', _videos_done,
      'total', _videos_total,
      'percent', CASE WHEN _videos_total > 0 THEN round((_videos_done::numeric / _videos_total) * 100) ELSE 0 END
    ),
    'completed_lessons', _completed,
    'best_score', _best,
    'score', _score,
    'score_parts', jsonb_build_object(
      'quiz_avg', _quiz_avg,
      'best_scripted', _p.best_scripted_score,
      'best_unscripted', _p.best_unscripted_score,
      'best_listening', _p.best_listening_score,
      'best_writing', _p.best_writing_score
    ),
    'progress', _progress,
    'courses', _courses,
    'recent', _recent
  );
END;
$fn$;