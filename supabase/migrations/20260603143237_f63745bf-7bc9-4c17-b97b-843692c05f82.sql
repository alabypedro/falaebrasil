CREATE TABLE IF NOT EXISTS public.fb_cefr_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  mode TEXT NOT NULL,
  score INTEGER,
  response_time_ms INTEGER,
  word_count INTEGER,
  perceived_quality INTEGER CHECK (perceived_quality >= 1 AND perceived_quality <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT ON public.fb_cefr_metrics TO authenticated;
GRANT ALL ON public.fb_cefr_metrics TO service_role;

-- Enable RLS
ALTER TABLE public.fb_cefr_metrics ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own metrics" ON public.fb_cefr_metrics;
CREATE POLICY "Users can view their own metrics"
ON public.fb_cefr_metrics
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own metrics" ON public.fb_cefr_metrics;
CREATE POLICY "Users can insert their own metrics"
ON public.fb_cefr_metrics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_cefr_metrics_user_id ON public.fb_cefr_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_cefr_metrics_level ON public.fb_cefr_metrics(level);
CREATE INDEX IF NOT EXISTS idx_cefr_metrics_mode ON public.fb_cefr_metrics(mode);