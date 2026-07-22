SELECT set_config('app.bypass_profile_protection','on', true);
UPDATE public.profiles
SET subscription_status = 'active',
    has_course_access = true,
    has_ebook1_access = true,
    has_ebook2_access = true,
    has_ebook3_access = true,
    plan_tier = COALESCE(plan_tier, 'open'),
    updated_at = now()
WHERE email = 'joisalaby@gmail.com';