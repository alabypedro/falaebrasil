CREATE TABLE public.fb_community_subfolders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.fb_communities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  whatsapp_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fb_community_subfolders_community ON public.fb_community_subfolders(community_id, sort_order);

GRANT SELECT ON public.fb_community_subfolders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fb_community_subfolders TO authenticated;
GRANT ALL ON public.fb_community_subfolders TO service_role;

ALTER TABLE public.fb_community_subfolders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subfolders"
ON public.fb_community_subfolders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert subfolders"
ON public.fb_community_subfolders FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subfolders"
ON public.fb_community_subfolders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subfolders"
ON public.fb_community_subfolders FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_fb_community_subfolders_updated_at
BEFORE UPDATE ON public.fb_community_subfolders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();