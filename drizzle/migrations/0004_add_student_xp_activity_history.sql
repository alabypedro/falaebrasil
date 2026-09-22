CREATE OR REPLACE FUNCTION public.get_student_progress_admin(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _p record;
  _progress jsonb := '[]'::jsonb;
  _ais jsonb := '[]'::jsonb;
  _bst jsonb;
  _books jsonb;
  _quiz_avg numeric;
  _videos_total int := 0;
  _videos_done int := 0;
  _recent jsonb := '[]'::jsonb;
  _activity_history jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(_uid, 'admin') OR public.is_my_student(_student_id)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT user_id, display_name, email, level, xp, plan_tier, created_at, last_activity,
         best_scripted_score, best_unscripted_score, best_listening_score, best_writing_score
    INTO _p
  FROM public.profiles WHERE user_id = _student_id;

  IF _p.user_id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;

  WITH allc AS (
    SELECT c.id, c.display_order,
           upper(coalesce(nullif(c.level, ''), substring(c.title from '\m([ABCTK][1-4])\M'))) AS code
    FROM public.courses c WHERE c.published = true
  ),
  cv AS (
    SELECT a.id AS course_id, a.code, a.display_order, v.id AS video_id
    FROM allc a
    JOIN public.modules m ON m.course_id = a.id
    JOIN public.lessons l ON l.module_id = m.id
    JOIN public.lesson_videos v ON v.lesson_id = l.id
    WHERE a.code IS NOT NULL
  ),
  vp AS (SELECT video_id FROM public.user_video_progress WHERE user_id = _student_id),
  agg AS (
    SELECT cv.code, min(cv.display_order) AS ord, count(*) AS total, count(vp.video_id) AS done
    FROM cv LEFT JOIN vp ON vp.video_id = cv.video_id GROUP BY cv.code
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'code', agg.code,
           'percent', CASE WHEN agg.total > 0 THEN round((agg.done::numeric / agg.total) * 100) ELSE 0 END,
           'videos_done', agg.done, 'videos_total', agg.total) ORDER BY agg.ord, agg.code), '[]'::jsonb),
         COALESCE(SUM(agg.total), 0), COALESCE(SUM(agg.done), 0)
    INTO _progress, _videos_total, _videos_done
  FROM agg;

  SELECT COALESCE(jsonb_object_agg(s.source, jsonb_build_object('xp', s.xp, 'events', s.events)), '{}'::jsonb)
    INTO _ais
  FROM (
    SELECT source, SUM(points)::int AS xp, count(*)::int AS events
    FROM public.ai_xp_events WHERE user_id = _student_id GROUP BY source
  ) s;

  SELECT jsonb_build_object(
    'falae_xp', COALESCE((SELECT SUM(points)::int FROM public.ai_xp_events
        WHERE user_id = _student_id AND key LIKE 'bst-falae:%'), 0),
    'falae_events', COALESCE((SELECT count(*)::int FROM public.ai_xp_events
        WHERE user_id = _student_id AND key LIKE 'bst-falae:%'), 0),
    'leiae_xp', COALESCE((SELECT SUM(points)::int FROM public.ai_xp_events
        WHERE user_id = _student_id AND source = 'leiae' AND key NOT LIKE '%:open'), 0),
    'leiae_events', COALESCE((SELECT count(*)::int FROM public.ai_xp_events
        WHERE user_id = _student_id AND source = 'leiae' AND key NOT LIKE '%:open'), 0),
    'quiz_attempts', COALESCE((SELECT count(*)::int FROM public.quiz_attempts qa
        JOIN public.quizzes q ON q.id = qa.quiz_id
        WHERE qa.user_id = _student_id AND q.bst_product_id IS NOT NULL), 0),
    'quiz_avg', (SELECT round(AVG(latest.score)) FROM (
        SELECT DISTINCT ON (qa.quiz_id) qa.quiz_id, qa.score
        FROM public.quiz_attempts qa JOIN public.quizzes q ON q.id = qa.quiz_id
        WHERE qa.user_id = _student_id AND q.bst_product_id IS NOT NULL
        ORDER BY qa.quiz_id, qa.created_at DESC) latest),
    'products', COALESCE((SELECT count(*)::int FROM public.bst_product_access WHERE user_id = _student_id), 0)
  ) INTO _bst;

  SELECT jsonb_build_object(
    'xp', COALESCE((SELECT SUM(points)::int FROM public.ai_xp_events
        WHERE user_id = _student_id AND source = 'books'), 0),
    'events', COALESCE((SELECT count(*)::int FROM public.ai_xp_events
        WHERE user_id = _student_id AND source = 'books'), 0),
    'chapters_read', COALESCE((SELECT count(*)::int FROM public.user_reading_progress
        WHERE user_id = _student_id), 0),
    'chapters_done', COALESCE((SELECT count(*)::int FROM public.user_reading_progress
        WHERE user_id = _student_id AND completed = true), 0),
    'quiz_avg', (SELECT round(AVG(latest.score)) FROM (
        SELECT DISTINCT ON (qa.quiz_id) qa.quiz_id, qa.score
        FROM public.quiz_attempts qa JOIN public.quizzes q ON q.id = qa.quiz_id
        WHERE qa.user_id = _student_id AND q.book_text_id IS NOT NULL
        ORDER BY qa.quiz_id, qa.created_at DESC) latest)
  ) INTO _books;

  SELECT round(AVG(latest.score)) INTO _quiz_avg FROM (
    SELECT DISTINCT ON (qa.quiz_id) qa.quiz_id, qa.score
    FROM public.quiz_attempts qa WHERE qa.user_id = _student_id
    ORDER BY qa.quiz_id, qa.created_at DESC) latest;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'at') DESC), '[]'::jsonb) INTO _recent
  FROM (
    SELECT jsonb_build_object('type', e.source, 'title', e.key, 'at', e.created_at, 'points', e.points) AS r
    FROM public.ai_xp_events e WHERE e.user_id = _student_id
    ORDER BY e.created_at DESC LIMIT 12
  ) x;

  WITH days AS (
    SELECT generate_series(current_date - 89, current_date, interval '1 day')::date AS day
  ), daily AS (
    SELECT e.created_at::date AS day, SUM(e.points)::int AS xp, COUNT(*)::int AS events
    FROM public.ai_xp_events e
    WHERE e.user_id = _student_id
      AND e.created_at >= current_date - 89
    GROUP BY e.created_at::date
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', d.day,
    'xp', COALESCE(a.xp, 0),
    'events', COALESCE(a.events, 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO _activity_history
  FROM days d
  LEFT JOIN daily a ON a.day = d.day;

  RETURN jsonb_build_object(
    'student', jsonb_build_object(
      'user_id', _p.user_id, 'display_name', _p.display_name, 'email', _p.email,
      'level', _p.level, 'plan_tier', _p.plan_tier, 'xp', _p.xp,
      'started_at', _p.created_at, 'last_activity', _p.last_activity,
      'ai_xp', COALESCE((SELECT SUM(points)::int FROM public.ai_xp_events WHERE user_id = _student_id), 0)
    ),
    'videos', jsonb_build_object('done', _videos_done, 'total', _videos_total,
      'percent', CASE WHEN _videos_total > 0 THEN round((_videos_done::numeric / _videos_total) * 100) ELSE 0 END),
    'quiz_avg', _quiz_avg,
    'scores', jsonb_build_object(
      'scripted', _p.best_scripted_score, 'unscripted', _p.best_unscripted_score,
      'listening', _p.best_listening_score, 'writing', _p.best_writing_score),
    'progress', _progress,
    'ais', _ais,
    'bst', _bst,
    'books', _books,
    'recent', _recent,
    'activity_history', _activity_history
  );
END;
$function$;