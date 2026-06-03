CREATE TABLE public.fb_learning_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  mistake_type TEXT NOT NULL,
  original_text TEXT,
  corrected_text TEXT,
  explanation TEXT,
  source_mode TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  last_occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_learning_challenges TO authenticated;
GRANT ALL ON public.fb_learning_challenges TO service_role;

-- Enable RLS
ALTER TABLE public.fb_learning_challenges ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own challenges"
ON public.fb_learning_challenges
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own challenges"
ON public.fb_learning_challenges
FOR ALL
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_learning_challenges_user_id ON public.fb_learning_challenges(user_id);
CREATE INDEX idx_learning_challenges_type ON public.fb_learning_challenges(mistake_type);