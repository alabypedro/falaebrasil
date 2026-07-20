DO $$
DECLARE
  p1_id uuid;
  p2_id uuid;
  p3_id uuid;
BEGIN
  SELECT id INTO p1_id FROM public.payment_products WHERE product_key = 'ebook_anfitriao';
  SELECT id INTO p2_id FROM public.payment_products WHERE product_key = 'ebook_decodificador';
  SELECT id INTO p3_id FROM public.payment_products WHERE product_key = 'ebook_vocabulario';

  IF p1_id IS NOT NULL THEN
    UPDATE public.payment_products SET product_key = 'ebook1' WHERE id = p1_id;
  END IF;
  IF p2_id IS NOT NULL THEN
    UPDATE public.payment_products SET product_key = 'ebook2' WHERE id = p2_id;
  END IF;
  IF p3_id IS NOT NULL THEN
    UPDATE public.payment_products SET product_key = 'ebook3' WHERE id = p3_id;
  END IF;

  INSERT INTO public.payment_products
    (product_key, name, description, type, price_cents, billing_cycle,
     grants_course_access, grants_ebook1_access, grants_ebook2_access, grants_ebook3_access,
     plan_tier, display_order)
  VALUES
    ('ebook1', 'Ebook: Anfitrião Soberano', 'Ebook exclusivo Falaê', 'one_time', 0, NULL,
     false, true, false, false, NULL, 2),
    ('ebook2', 'Ebook: O Decodificador de Gringo', 'Ebook exclusivo Falaê', 'one_time', 0, NULL,
     false, false, true, false, NULL, 3),
    ('ebook3', 'Ebook: O Vocabulário de Poder', 'Ebook exclusivo Falaê', 'one_time', 0, NULL,
     false, false, false, true, NULL, 4)
  ON CONFLICT (product_key) DO NOTHING;
END $$;
