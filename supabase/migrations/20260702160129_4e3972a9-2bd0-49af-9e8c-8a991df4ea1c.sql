
CREATE TABLE public.leiae_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  level text NOT NULL DEFAULT 'A1' CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  course_id uuid NULL REFERENCES public.courses(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leiae_texts TO authenticated;
GRANT ALL ON public.leiae_texts TO service_role;

ALTER TABLE public.leiae_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read leiae texts"
  ON public.leiae_texts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert leiae texts"
  ON public.leiae_texts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leiae texts"
  ON public.leiae_texts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leiae texts"
  ON public.leiae_texts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_leiae_texts_updated_at
  BEFORE UPDATE ON public.leiae_texts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leiae_texts_level ON public.leiae_texts(level, display_order);
