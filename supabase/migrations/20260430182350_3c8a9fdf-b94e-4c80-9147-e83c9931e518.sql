ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles
SET xp = xp + 30,
    level = public.calculate_level_from_xp(xp + 30)
WHERE user_id = '9d6edf9d-1ffe-43e7-8351-3ccadf331401';
ALTER TABLE public.profiles ENABLE TRIGGER USER;
