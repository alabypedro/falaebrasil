
CREATE TABLE IF NOT EXISTS public.tutorials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view published tutorials" ON public.tutorials;
  CREATE POLICY "Anyone authenticated can view published tutorials"
  ON public.tutorials FOR SELECT TO authenticated
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert tutorials" ON public.tutorials;
  CREATE POLICY "Admins can insert tutorials"
  ON public.tutorials FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update tutorials" ON public.tutorials;
  CREATE POLICY "Admins can update tutorials"
  ON public.tutorials FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete tutorials" ON public.tutorials;
  CREATE POLICY "Admins can delete tutorials"
  ON public.tutorials FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER update_tutorials_updated_at
  BEFORE UPDATE ON public.tutorials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
