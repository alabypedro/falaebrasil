-- Tabela de múltiplas videoaulas por lição
CREATE TABLE IF NOT EXISTS public.lesson_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  video_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson_id ON public.lesson_videos(lesson_id, display_order);

ALTER TABLE public.lesson_videos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (mesma lógica das lessons)
DROP POLICY IF EXISTS "Authenticated users can view lesson videos" ON public.lesson_videos;
  CREATE POLICY "Authenticated users can view lesson videos"
  ON public.lesson_videos FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: admins
DROP POLICY IF EXISTS "Admins can insert lesson videos" ON public.lesson_videos;
  CREATE POLICY "Admins can insert lesson videos"
  ON public.lesson_videos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update lesson videos" ON public.lesson_videos;
  CREATE POLICY "Admins can update lesson videos"
  ON public.lesson_videos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete lesson videos" ON public.lesson_videos;
  CREATE POLICY "Admins can delete lesson videos"
  ON public.lesson_videos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER update_lesson_videos_updated_at
  BEFORE UPDATE ON public.lesson_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar video_url existente para a nova tabela como primeira videoaula
INSERT INTO public.lesson_videos (lesson_id, title, video_url, display_order)
SELECT id, 'Videoaula 1', video_url, 0
FROM public.lessons
WHERE video_url IS NOT NULL AND trim(video_url) <> '';