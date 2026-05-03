UPDATE public.profiles
SET welcome_email_sent_at = NULL
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'rosanaalaby@gmail.com');