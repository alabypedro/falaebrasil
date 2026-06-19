
CREATE TABLE IF NOT EXISTS public.fb_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  whatsapp_url text,
  access_key text NOT NULL DEFAULT 'free',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view communities" ON public.fb_communities;
CREATE POLICY "Authenticated users can view communities"
ON public.fb_communities FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert communities" ON public.fb_communities;
CREATE POLICY "Admins can insert communities"
ON public.fb_communities FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update communities" ON public.fb_communities;
CREATE POLICY "Admins can update communities"
ON public.fb_communities FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete communities" ON public.fb_communities;
CREATE POLICY "Admins can delete communities"
ON public.fb_communities FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE TRIGGER fb_communities_updated_at
BEFORE UPDATE ON public.fb_communities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.fb_communities (title, description, whatsapp_url, access_key, sort_order) VALUES
  ('Lets Falaê', 'Quizzes e músicas com letras', NULL, 'free', 1),
  ('My Questions Falaê', 'Plantão de dúvidas no horário comercial', NULL, 'free', 2),
  ('FB Básico PRO (A1)', 'Orientações e calendário de aulas', NULL, 'a1', 3),
  ('A2', NULL, NULL, 'a2', 4),
  ('B1', NULL, NULL, 'b1', 5),
  ('B2', NULL, NULL, 'b2', 6);
