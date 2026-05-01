-- 1) Corrigir o ID do produto principal para bater com o que a Hubla envia
UPDATE public.hubla_product_mapping
SET hubla_product_id = '7YNOATVITU1bdajEeUGU',
    updated_at = now()
WHERE product_key = 'essencial_pro_a1';

-- 2) Apagar o usuário de teste (cascade limpa profile, roles, etc.)
DELETE FROM auth.users WHERE email = 'andreabcdefg1212@gmail.com';

-- Limpeza defensiva caso algum registro órfão tenha sobrado em profiles
DELETE FROM public.profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);