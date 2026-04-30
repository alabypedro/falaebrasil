UPDATE public.profiles
SET xp = xp + 30,
    level = public.calculate_level_from_xp(xp + 30)
WHERE user_id = '9d6edf9d-1ffe-43e7-8351-3ccadf331401';