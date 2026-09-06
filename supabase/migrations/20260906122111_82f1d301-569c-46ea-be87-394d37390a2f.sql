CREATE TABLE public.book_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  author text,
  content text NOT NULL,
  audio_url text,
  level text NOT NULL DEFAULT 'A1',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_texts TO authenticated;
GRANT ALL ON public.book_texts TO service_role;

ALTER TABLE public.book_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read book texts"
ON public.book_texts FOR SELECT TO authenticated
USING (public.has_open_category(auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins manage book texts"
ON public.book_texts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_book_texts_updated_at
BEFORE UPDATE ON public.book_texts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();