ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS required_tier text NOT NULL DEFAULT 'open';
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_required_tier_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_required_tier_check CHECK (required_tier IN ('open','pro','vip','teens','kids'));