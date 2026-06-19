
CREATE TABLE IF NOT EXISTS public.pronunciation_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'A1',
  source_file TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pronunciation_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view prompts" ON public.pronunciation_prompts;
CREATE POLICY "Anyone authenticated can view prompts"
ON public.pronunciation_prompts FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert prompts" ON public.pronunciation_prompts;
CREATE POLICY "Admins can insert prompts"
ON public.pronunciation_prompts FOR INSERT
TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update prompts" ON public.pronunciation_prompts;
CREATE POLICY "Admins can update prompts"
ON public.pronunciation_prompts FOR UPDATE
TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete prompts" ON public.pronunciation_prompts;
CREATE POLICY "Admins can delete prompts"
ON public.pronunciation_prompts FOR DELETE
TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
