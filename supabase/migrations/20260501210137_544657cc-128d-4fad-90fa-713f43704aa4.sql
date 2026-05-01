-- Remove leftover Hubla proxy user created by mistake
DELETE FROM public.profiles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'janderson.silva+202308280001@hub.la');
DELETE FROM auth.users WHERE email = 'janderson.silva+202308280001@hub.la';