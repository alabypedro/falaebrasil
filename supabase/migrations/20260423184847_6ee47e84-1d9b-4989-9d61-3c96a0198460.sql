-- =========================================
-- Community Channels
-- =========================================
CREATE TABLE IF NOT EXISTS public.community_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view channels" ON public.community_channels;
CREATE POLICY "Anyone authenticated can view channels"
ON public.community_channels FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert channels" ON public.community_channels;
CREATE POLICY "Admins can insert channels"
ON public.community_channels FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update channels" ON public.community_channels;
CREATE POLICY "Admins can update channels"
ON public.community_channels FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete channels" ON public.community_channels;
CREATE POLICY "Admins can delete channels"
ON public.community_channels FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER update_community_channels_updated_at
BEFORE UPDATE ON public.community_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Community Messages
-- =========================================
CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio')),
  content text,
  audio_url text,
  audio_duration_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_channel_created
  ON public.community_messages(channel_id, created_at DESC);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view messages" ON public.community_messages;
CREATE POLICY "Authenticated can view messages"
ON public.community_messages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can send their own messages" ON public.community_messages;
CREATE POLICY "Users can send their own messages"
ON public.community_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.community_messages;
CREATE POLICY "Users can delete their own messages"
ON public.community_messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete any message" ON public.community_messages;
CREATE POLICY "Admins can delete any message"
ON public.community_messages FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;

-- =========================================
-- Storage bucket for community audio
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-audio', 'community-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read community audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'community-audio');

CREATE POLICY "Users can upload their own community audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own community audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =========================================
-- Seed initial channels
-- =========================================
INSERT INTO public.community_channels (name, slug, description, display_order) VALUES
  ('Geral', 'geral', 'Bate-papo geral da comunidade Falaê Brasil', 1),
  ('Dúvidas', 'duvidas', 'Tire suas dúvidas sobre inglês e os cursos', 2),
  ('Conversação', 'conversacao', 'Pratique inglês com outros estudantes (envie áudios!)', 3);