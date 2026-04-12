
-- 1. Alter profiles: add user_type and hubla_customer_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'adult'
    CHECK (user_type IN ('adult', 'teen', 'kid')),
  ADD COLUMN IF NOT EXISTS hubla_customer_id text;

-- 2. Alter courses: add category
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transversal'
    CHECK (category IN ('transversal', 'bst'));

-- 3. Create user_progress
CREATE TABLE IF NOT EXISTS public.user_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON public.user_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create voice_sessions
CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('scripted', 'unscripted')),
  text_analyzed text,
  accuracy_score integer,
  fluency_score integer,
  prosody_score integer,
  grammar_feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice sessions"
  ON public.voice_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice sessions"
  ON public.voice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Create library_bst
CREATE TABLE IF NOT EXISTS public.library_bst (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('ebook', 'audiobook')),
  file_url text,
  audio_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.library_bst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view library"
  ON public.library_bst FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert library items"
  ON public.library_bst FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update library items"
  ON public.library_bst FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete library items"
  ON public.library_bst FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. XP Ranking view
CREATE OR REPLACE VIEW public.xp_ranking AS
SELECT
  p.user_id,
  p.display_name,
  p.avatar_url,
  p.level,
  p.xp AS total_xp,
  p.user_type,
  RANK() OVER (ORDER BY p.xp DESC) AS rank_position
FROM public.profiles p
ORDER BY p.xp DESC;
