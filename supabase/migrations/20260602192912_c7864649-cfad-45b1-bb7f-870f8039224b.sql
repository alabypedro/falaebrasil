-- Create table for structured listening lessons
CREATE TABLE IF NOT EXISTS public.listening_lessons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL DEFAULT 'A1',
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT ON public.listening_lessons TO authenticated;
GRANT SELECT ON public.listening_lessons TO anon;
GRANT ALL ON public.listening_lessons TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.listening_lessons TO authenticated;

-- Enable RLS
ALTER TABLE public.listening_lessons ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Everyone can view listening lessons" ON public.listening_lessons;
CREATE POLICY "Everyone can view listening lessons"
ON public.listening_lessons FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage listening lessons" ON public.listening_lessons;
CREATE POLICY "Admins can manage listening lessons"
ON public.listening_lessons FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
);

-- Updated at trigger
CREATE OR REPLACE TRIGGER update_listening_lessons_updated_at
BEFORE UPDATE ON public.listening_lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();