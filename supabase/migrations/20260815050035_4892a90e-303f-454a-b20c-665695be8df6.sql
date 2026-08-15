-- 1. Relação professor <-> aluno
CREATE TABLE IF NOT EXISTS public.teacher_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON public.teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON public.teacher_students(student_id);

GRANT SELECT, INSERT, DELETE ON public.teacher_students TO authenticated;
GRANT ALL ON public.teacher_students TO service_role;

ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage teacher_students" ON public.teacher_students;
CREATE POLICY "Admins manage teacher_students"
ON public.teacher_students FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Teachers view their own links" ON public.teacher_students;
CREATE POLICY "Teachers view their own links"
ON public.teacher_students FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

-- 2. Helper: aluno vinculado ao professor autenticado?
CREATE OR REPLACE FUNCTION public.is_my_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teacher_students ts
      WHERE ts.teacher_id = auth.uid() AND ts.student_id = _student_id
    )
$$;

REVOKE ALL ON FUNCTION public.is_my_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_student(uuid) TO authenticated, service_role;

-- 3. Lista de alunos do professor autenticado (busca server-side)
CREATE OR REPLACE FUNCTION public.get_my_students(_search text DEFAULT NULL)
RETURNS TABLE(
  student_id uuid,
  display_name text,
  email text,
  level text,
  xp integer,
  plan_tier text,
  last_activity timestamptz,
  linked_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(_uid, 'teacher'::app_role) OR public.has_role(_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.display_name, p.email, p.level, p.xp, p.plan_tier, p.last_activity, ts.created_at
  FROM public.teacher_students ts
  JOIN public.profiles p ON p.user_id = ts.student_id
  WHERE ts.teacher_id = _uid
    AND (
      _search IS NULL OR btrim(_search) = ''
      OR p.display_name ILIKE '%' || btrim(_search) || '%'
      OR p.email ILIKE '%' || btrim(_search) || '%'
    )
  ORDER BY p.display_name NULLS LAST, p.email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_students(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_students(text) TO authenticated, service_role;

-- 4. Performance pedagógica de um aluno vinculado
CREATE OR REPLACE FUNCTION public.get_student_performance(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p record;
  _course_ids uuid[];
  _videos_total int := 0;
  _videos_done int := 0;
  _courses jsonb := '[]'::jsonb;
  _quiz_avg numeric;
  _best jsonb;
  _score numeric;
  _components numeric[];
  _recent jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_my_student(_student_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT user_id, display_name, level, xp, plan_tier, created_at, last_activity,
         best_scripted_score, best_unscripted_score, best_listening_score, best_writing_score,
         has_course_access
    INTO _p
  FROM public.profiles WHERE user_id = _student_id;

  IF _p.user_id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;

  -- Cursos aos quais o aluno tem acesso
  SELECT COALESCE(array_agg(DISTINCT course_id), ARRAY[]::uuid[]) INTO _course_ids
  FROM public.user_course_access WHERE user_id = _student_id;

  IF array_length(_course_ids, 1) IS NULL AND COALESCE(_p.has_course_access, false) THEN
    SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO _course_ids
    FROM public.courses c
    WHERE c.published = true
      AND public.tier_rank(_p.plan_tier) >= public.tier_rank(c.required_tier);
  END IF;

  -- Detalhamento por curso (vídeos + melhor quiz)
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

  -- Média dos quizzes (uma tentativa por quiz) + melhor pontuação
  SELECT AVG(score) INTO _quiz_avg FROM public.quiz_attempts WHERE user_id = _student_id;

  SELECT jsonb_build_object('score', qa.score, 'quiz_title', q.title, 'level', q.level, 'created_at', qa.created_at)
    INTO _best
  FROM public.quiz_attempts qa
  JOIN public.quizzes q ON q.id = qa.quiz_id
  WHERE qa.user_id = _student_id
  ORDER BY qa.score DESC, qa.created_at DESC
  LIMIT 1;

  -- SCORE = mesma fórmula da "Nota Média" exibida ao aluno
  _components := ARRAY(
    SELECT x FROM unnest(ARRAY[
      _quiz_avg, _p.best_scripted_score, _p.best_unscripted_score,
      _p.best_listening_score, _p.best_writing_score
    ]) AS x WHERE x IS NOT NULL
  );
  IF array_length(_components, 1) IS NOT NULL THEN
    SELECT AVG(v) INTO _score FROM unnest(_components) AS v;
  END IF;

  -- Atividades recentes (dados já registrados)
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
      'plan_tier', _p.plan_tier,
      'started_at', _p.created_at,
      'last_activity', _p.last_activity
    ),
    'videos', jsonb_build_object(
      'done', _videos_done,
      'total', _videos_total,
      'percent', CASE WHEN _videos_total > 0 THEN round((_videos_done::numeric / _videos_total) * 100) ELSE 0 END
    ),
    'best_score', _best,
    'score', _score,
    'score_parts', jsonb_build_object(
      'quiz_avg', _quiz_avg,
      'best_scripted', _p.best_scripted_score,
      'best_unscripted', _p.best_unscripted_score,
      'best_listening', _p.best_listening_score,
      'best_writing', _p.best_writing_score
    ),
    'courses', _courses,
    'recent', _recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_performance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_performance(uuid) TO authenticated, service_role;