
ALTER TABLE public.hubla_product_mapping
  ADD COLUMN IF NOT EXISTS grants_tier text CHECK (grants_tier IN ('pro','vip'));

UPDATE public.hubla_product_mapping SET grants_tier = 'pro' WHERE product_key = 'plano_pro';
UPDATE public.hubla_product_mapping SET grants_tier = 'vip' WHERE product_key = 'plano_vip';
