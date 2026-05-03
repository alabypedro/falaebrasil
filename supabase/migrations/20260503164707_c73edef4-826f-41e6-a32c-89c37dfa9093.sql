ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles
SET has_course_access=true,
    has_ebook1_access=true,
    has_ebook2_access=true,
    has_ebook3_access=true,
    scripted_balance=scripted_balance+2400,
    unscripted_balance=unscripted_balance+1200
WHERE user_id='1840d9dd-fa55-42cc-84b9-ebbad4134095';
ALTER TABLE public.profiles ENABLE TRIGGER USER;

INSERT INTO public.voice_credit_grants (user_id, hubla_event_id, hubla_product_id, scripted_seconds_added, unscripted_seconds_added, raw_payload) VALUES
 ('1840d9dd-fa55-42cc-84b9-ebbad4134095','manual-rosanaalaby-course','7YNOATVITU1bdajEeUGU',600,300,'{"manual":true}'::jsonb),
 ('1840d9dd-fa55-42cc-84b9-ebbad4134095','manual-rosanaalaby-ebook1','BiAELgn1wGL769DhVBz3',600,300,'{"manual":true}'::jsonb),
 ('1840d9dd-fa55-42cc-84b9-ebbad4134095','manual-rosanaalaby-ebook2','fBKek3TTqjku4NvYZJjE',600,300,'{"manual":true}'::jsonb),
 ('1840d9dd-fa55-42cc-84b9-ebbad4134095','manual-rosanaalaby-ebook3','3cb0l2uslWtLQM7Kvtry',600,300,'{"manual":true}'::jsonb)
ON CONFLICT DO NOTHING;