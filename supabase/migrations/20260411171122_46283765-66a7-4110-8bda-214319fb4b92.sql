
-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles policies
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL DEFAULT 'A1',
  thumbnail_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published courses" ON public.courses
  FOR SELECT TO authenticated USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert courses" ON public.courses
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update courses" ON public.courses
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete courses" ON public.courses
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Modules table
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view modules" ON public.modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert modules" ON public.modules
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update modules" ON public.modules
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete modules" ON public.modules
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  pdf_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view lessons" ON public.lessons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert lessons" ON public.lessons
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update lessons" ON public.lessons
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lessons" ON public.lessons
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view quizzes" ON public.quizzes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert quizzes" ON public.quizzes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update quizzes" ON public.quizzes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete quizzes" ON public.quizzes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Quiz questions table
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option_index INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view questions" ON public.quiz_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert questions" ON public.quiz_questions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update questions" ON public.quiz_questions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions" ON public.quiz_questions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Quiz attempts table
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Storage bucket for lesson PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-files', 'lesson-files', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view lesson files" ON storage.objects
  FOR SELECT USING (bucket_id = 'lesson-files');

CREATE POLICY "Admins can upload lesson files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update lesson files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lesson files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-files' AND public.has_role(auth.uid(), 'admin'));
