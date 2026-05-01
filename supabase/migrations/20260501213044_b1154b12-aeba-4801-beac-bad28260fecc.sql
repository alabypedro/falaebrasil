UPDATE public.profiles
SET has_course_access = true,
    has_ebook3_access = true,
    hubla_customer_id = COALESCE(hubla_customer_id, 'ZISGFCDdHlgtSozl0uUZmvfShry2')
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'andreskinchangercs@gmail.com');