DO $$
DECLARE
  c1_id uuid;
  c2_id uuid;
  mod_id uuid;
  cid uuid;
  mod_titles text[] := ARRAY['Empreendedorismo', 'Multinacionais', 'Turismo'];
  mod_title text;
  mod_order int;
  unit_order int;
BEGIN
  INSERT INTO public.courses (title, description, level, display_order, published, category, required_tier)
  VALUES ('FB Pré-Avançado (C1)', NULL, 'C1', 5, true, 'transversal', 'open')
  RETURNING id INTO c1_id;

  INSERT INTO public.courses (title, description, level, display_order, published, category, required_tier)
  VALUES ('FB Avançado (C2)', NULL, 'C2', 6, true, 'transversal', 'open')
  RETURNING id INTO c2_id;

  FOREACH cid IN ARRAY ARRAY[c1_id, c2_id] LOOP
    mod_order := 1;
    FOREACH mod_title IN ARRAY mod_titles LOOP
      INSERT INTO public.modules (course_id, title, display_order)
      VALUES (cid, mod_title, mod_order)
      RETURNING id INTO mod_id;

      FOR unit_order IN 1..4 LOOP
        INSERT INTO public.lessons (module_id, title, display_order)
        VALUES (mod_id, 'Unit ' || unit_order, unit_order);
      END LOOP;

      mod_order := mod_order + 1;
    END LOOP;
  END LOOP;
END $$;