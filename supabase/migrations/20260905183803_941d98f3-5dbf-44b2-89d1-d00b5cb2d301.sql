-- BOOKS
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  description text,
  level text NOT NULL DEFAULT 'A1',
  category text NOT NULL DEFAULT 'Short Stories',
  cover_url text,
  published boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_select" ON public.books FOR SELECT TO authenticated
  USING (published AND (public.has_open_category(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'teacher'::app_role)));
CREATE POLICY "books_admin_all" ON public.books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- CHAPTERS
CREATE TABLE public.book_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  title text NOT NULL,
  chapter_index integer NOT NULL DEFAULT 1,
  content text NOT NULL DEFAULT '',
  audio_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_chapters TO authenticated;
GRANT ALL ON public.book_chapters TO service_role;
ALTER TABLE public.book_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_chapters_select" ON public.book_chapters FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.published)
         AND (public.has_open_category(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'teacher'::app_role)));
CREATE POLICY "book_chapters_admin_all" ON public.book_chapters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- GLOSSARY (click-to-define)
CREATE TABLE public.book_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.book_chapters(id) ON DELETE CASCADE,
  term text NOT NULL,
  definition text NOT NULL,
  example text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_glossary TO authenticated;
GRANT ALL ON public.book_glossary TO service_role;
ALTER TABLE public.book_glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_glossary_select" ON public.book_glossary FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.book_chapters c JOIN public.books b ON b.id = c.book_id WHERE c.id = chapter_id AND b.published)
         AND (public.has_open_category(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'teacher'::app_role)));
CREATE POLICY "book_glossary_admin_all" ON public.book_glossary FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- QUIZ QUESTIONS
CREATE TABLE public.book_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.book_chapters(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option_index integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_quizzes TO authenticated;
GRANT ALL ON public.book_quizzes TO service_role;
ALTER TABLE public.book_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_quizzes_admin_all" ON public.book_quizzes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- READING PROGRESS
CREATE TABLE public.user_reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.book_chapters(id) ON DELETE CASCADE,
  progress_percent integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  quiz_score integer,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reading_progress TO authenticated;
GRANT ALL ON public.user_reading_progress TO service_role;
ALTER TABLE public.user_reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reading_progress_own" ON public.user_reading_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reading_progress_admin_select" ON public.user_reading_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_my_student(user_id));

-- TRIGGERS
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_book_chapters_updated_at BEFORE UPDATE ON public.book_chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_book_glossary_updated_at BEFORE UPDATE ON public.book_glossary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_book_quizzes_updated_at BEFORE UPDATE ON public.book_quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reading_progress_updated_at BEFORE UPDATE ON public.user_reading_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Perguntas sem a resposta correta para o aluno
CREATE OR REPLACE FUNCTION public.get_book_quiz(_chapter_id uuid)
RETURNS TABLE(id uuid, question_text text, options jsonb, display_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.question_text, q.options, q.display_order
  FROM public.book_quizzes q
  JOIN public.book_chapters c ON c.id = q.chapter_id
  JOIN public.books b ON b.id = c.book_id
  WHERE q.chapter_id = _chapter_id
    AND b.published
    AND (public.has_open_category(auth.uid())
         OR public.has_role(auth.uid(),'admin'::app_role)
         OR public.has_role(auth.uid(),'teacher'::app_role))
  ORDER BY q.display_order
$$;
REVOKE ALL ON FUNCTION public.get_book_quiz(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_book_quiz(uuid) TO authenticated;

-- Correção do quiz + XP
CREATE OR REPLACE FUNCTION public.submit_book_quiz(_chapter_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _total int := 0; _correct int := 0; _score int := 0;
  _book uuid; _details jsonb := '[]'::jsonb; _r record; _given int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT c.book_id INTO _book FROM public.book_chapters c WHERE c.id = _chapter_id;
  IF _book IS NULL THEN RAISE EXCEPTION 'Chapter not found'; END IF;

  FOR _r IN SELECT * FROM public.book_quizzes WHERE chapter_id = _chapter_id ORDER BY display_order LOOP
    _total := _total + 1;
    _given := NULLIF(_answers->>_r.id::text, '')::int;
    IF _given IS NOT NULL AND _given = _r.correct_option_index THEN _correct := _correct + 1; END IF;
    _details := _details || jsonb_build_object(
      'id', _r.id,
      'correct_option_index', _r.correct_option_index,
      'given', _given,
      'is_correct', COALESCE(_given = _r.correct_option_index, false)
    );
  END LOOP;

  IF _total > 0 THEN _score := round(_correct::numeric * 100 / _total); END IF;

  INSERT INTO public.user_reading_progress(user_id, book_id, chapter_id, progress_percent, completed, quiz_score, last_read_at)
  VALUES (_uid, _book, _chapter_id, 100, true, _score, now())
  ON CONFLICT (user_id, chapter_id) DO UPDATE
    SET quiz_score = GREATEST(COALESCE(public.user_reading_progress.quiz_score, 0), _score),
        completed = true, progress_percent = 100, last_read_at = now();

  PERFORM public.award_ai_xp('books', GREATEST(5, _correct * 10), 'books:quiz:' || _chapter_id::text);

  RETURN jsonb_build_object('score', _score, 'correct', _correct, 'total', _total, 'details', _details);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_book_quiz(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_book_quiz(uuid, jsonb) TO authenticated;

-- Nova origem de XP: books
CREATE OR REPLACE FUNCTION public.award_ai_xp(_source text, _points integer, _key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted_id uuid;
  _ai_total int;
  _profile_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _source NOT IN ('memorizae','leiae','falae','escutae','escreveae','musiclab','books') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;
  IF _points IS NULL OR _points < 0 OR _points > 500 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;
  IF _key IS NULL OR length(_key) = 0 THEN RAISE EXCEPTION 'Invalid key'; END IF;

  INSERT INTO public.ai_xp_events(user_id, source, points, key)
  VALUES (_uid, _source, _points, _key)
  ON CONFLICT (user_id, key) DO NOTHING
  RETURNING id INTO _inserted_id;

  SELECT COALESCE(SUM(points),0) INTO _ai_total FROM public.ai_xp_events WHERE user_id = _uid;
  SELECT COALESCE(xp,0) INTO _profile_xp FROM public.profiles WHERE id = _uid;

  RETURN jsonb_build_object(
    'awarded', _inserted_id IS NOT NULL,
    'points', CASE WHEN _inserted_id IS NOT NULL THEN _points ELSE 0 END,
    'total_xp', _profile_xp + _ai_total
  );
END;
$$;