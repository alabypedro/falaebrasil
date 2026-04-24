-- 1. Add level column to community_channels
ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'A1';

-- 2. Helper function: numeric rank for a CEFR level
CREATE OR REPLACE FUNCTION public.level_rank(_level text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(_level, 'A1'))
    WHEN 'A1' THEN 1
    WHEN 'A2' THEN 2
    WHEN 'B1' THEN 3
    WHEN 'B2' THEN 4
    WHEN 'C1' THEN 5
    WHEN 'C2' THEN 6
    ELSE 1
  END
$$;

-- 3. Helper function: can the current user access a given channel level?
CREATE OR REPLACE FUNCTION public.can_access_level(_level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND public.level_rank(p.level) >= public.level_rank(_level)
    )
$$;

-- 4. Clean up old channels (they have no level grouping)
DELETE FROM public.community_messages
WHERE channel_id IN (SELECT id FROM public.community_channels);
DELETE FROM public.community_channels;

-- 5. Seed 4 communities × 3 chats = 12 channels
INSERT INTO public.community_channels (name, slug, description, level, display_order) VALUES
  ('Bate-papo geral',     'a1-geral',    'Conversa livre da comunidade A1',           'A1', 1),
  ('Dúvidas',             'a1-duvidas',  'Tire suas dúvidas no nível A1',             'A1', 2),
  ('Prática de áudio',    'a1-audio',    'Envie áudios e pratique pronúncia (A1)',    'A1', 3),
  ('Bate-papo geral',     'a2-geral',    'Conversa livre da comunidade A2',           'A2', 4),
  ('Dúvidas',             'a2-duvidas',  'Tire suas dúvidas no nível A2',             'A2', 5),
  ('Prática de áudio',    'a2-audio',    'Envie áudios e pratique pronúncia (A2)',    'A2', 6),
  ('Bate-papo geral',     'b1-geral',    'Conversa livre da comunidade B1',           'B1', 7),
  ('Dúvidas',             'b1-duvidas',  'Tire suas dúvidas no nível B1',             'B1', 8),
  ('Prática de áudio',    'b1-audio',    'Envie áudios e pratique pronúncia (B1)',    'B1', 9),
  ('Bate-papo geral',     'b2-geral',    'Conversa livre da comunidade B2',           'B2', 10),
  ('Dúvidas',             'b2-duvidas',  'Tire suas dúvidas no nível B2',             'B2', 11),
  ('Prática de áudio',    'b2-audio',    'Envie áudios e pratique pronúncia (B2)',    'B2', 12);

-- 6. Replace channel SELECT policy: user sees only channels at or below their level
DROP POLICY IF EXISTS "Anyone authenticated can view channels" ON public.community_channels;
CREATE POLICY "Users view channels at their level"
ON public.community_channels
FOR SELECT
TO authenticated
USING (public.can_access_level(level));

-- 7. Tighten messages policies: only members of accessible channels can read/write
DROP POLICY IF EXISTS "Authenticated can view messages" ON public.community_messages;
CREATE POLICY "Users view messages of accessible channels"
ON public.community_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE c.id = community_messages.channel_id
      AND public.can_access_level(c.level)
  )
);

DROP POLICY IF EXISTS "Users can send their own messages" ON public.community_messages;
CREATE POLICY "Users send messages to accessible channels"
ON public.community_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.community_channels c
    WHERE c.id = community_messages.channel_id
      AND public.can_access_level(c.level)
  )
);