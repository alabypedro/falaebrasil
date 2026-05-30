-- Change column types in voice_sessions to support decimals
ALTER TABLE public.voice_sessions
ALTER COLUMN accuracy_score TYPE NUMERIC,
ALTER COLUMN fluency_score TYPE NUMERIC,
ALTER COLUMN prosody_score TYPE NUMERIC;
