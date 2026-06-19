-- Update credits for the main product
UPDATE public.voice_credit_products
SET scripted_seconds = 1800,
    unscripted_seconds = 1800,
    display_name = 'Plano OPEN'
WHERE hubla_product_id = '7YNOATVITU1bdajEeUGU';

-- Grant full library access to the main product in the mapping
UPDATE public.hubla_product_mapping
SET grants_course = true,
    grants_ebook1 = true,
    grants_ebook2 = true,
    grants_ebook3 = true,
    display_name = 'Plano OPEN'
WHERE hubla_product_id = '7YNOATVITU1bdajEeUGU';

-- Remove credits from separate ebook products to avoid double crediting
-- or at least zero them out if they are now included in the main plan
UPDATE public.voice_credit_products
SET scripted_seconds = 0,
    unscripted_seconds = 0
WHERE hubla_product_id IN ('BiAELgn1wGL769DhVBz3', 'fBKek3TTqjku4NvYZJjE', '3cb0l2uslWtLQM7Kvtry');

-- Apply the new balance to the specific user mentioned (1800/1800)
-- We need to use the bypass protection for direct profile updates
ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles
SET scripted_balance = 1800,
    unscripted_balance = 1800
WHERE email = 'michael.clemes@icloud.com';
ALTER TABLE public.profiles ENABLE TRIGGER USER;