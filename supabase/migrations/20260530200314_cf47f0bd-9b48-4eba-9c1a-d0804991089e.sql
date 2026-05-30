-- Add high score columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS best_scripted_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_unscripted_score NUMERIC DEFAULT 0;

-- Update the existing update policy if needed (it usually already allows updating all columns for the user)
-- No changes needed if the policy is "Users can update their own profile" using (auth.uid() = user_id)
