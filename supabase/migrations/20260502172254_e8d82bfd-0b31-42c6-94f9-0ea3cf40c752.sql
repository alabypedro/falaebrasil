CREATE TABLE IF NOT EXISTS public.install_tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE CHECK (platform IN ('ios','android','desktop')),
  video_url text,
  title text NOT NULL DEFAULT 'Como instalar o aplicativo',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.install_tutorial_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view install tutorial videos" ON public.install_tutorial_videos;
CREATE POLICY "Authenticated can view install tutorial videos"
ON public.install_tutorial_videos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert install tutorial videos" ON public.install_tutorial_videos;
CREATE POLICY "Admins can insert install tutorial videos"
ON public.install_tutorial_videos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update install tutorial videos" ON public.install_tutorial_videos;
CREATE POLICY "Admins can update install tutorial videos"
ON public.install_tutorial_videos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete install tutorial videos" ON public.install_tutorial_videos;
CREATE POLICY "Admins can delete install tutorial videos"
ON public.install_tutorial_videos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER update_install_tutorial_videos_updated_at
BEFORE UPDATE ON public.install_tutorial_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.install_tutorial_videos (platform, title, description) VALUES
  ('ios', 'Como instalar o aplicativo no iPhone/iPad', 'Tutorial de instalação para iOS'),
  ('android', 'Como instalar o aplicativo no Android', 'Tutorial de instalação para Android'),
  ('desktop', 'Como instalar o aplicativo no PC', 'Tutorial de instalação para computador');