-- OPEN também recebe registros explícitos de todos os produtos BST,
-- para o painel admin refletir sempre a liberação real.
CREATE OR REPLACE FUNCTION public.apply_student_category(_user_id uuid, _code text, _source text DEFAULT 'asaas'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _kind text;
BEGIN
  IF _code IS NULL THEN RETURN; END IF;
  SELECT kind INTO _kind FROM public.student_category_defs WHERE code = _code;
  IF _kind IS NULL THEN RETURN; END IF;

  INSERT INTO public.student_categories (user_id, code, source)
  VALUES (_user_id, _code, _source)
  ON CONFLICT (user_id, code) DO NOTHING;

  IF _kind = 'open' THEN
    DELETE FROM public.student_categories sc
    USING public.student_category_defs d
    WHERE sc.code = d.code AND sc.user_id = _user_id AND d.kind = 'bst';

    INSERT INTO public.user_course_access (user_id, course_id, source)
    SELECT _user_id, c.id, _source FROM public.courses c
    ON CONFLICT DO NOTHING;

    INSERT INTO public.bst_product_access (user_id, product_id, source)
    SELECT _user_id, b.id, _source FROM public.bst_products b WHERE b.active = true
    ON CONFLICT DO NOTHING;

    PERFORM set_config('app.bypass_profile_protection', 'on', true);
    UPDATE public.profiles
    SET has_course_access = true,
        plan_tier = CASE
          WHEN lower(coalesce(plan_tier, '')) IN ('pro', 'vip', 'kids', 'teens') THEN plan_tier
          ELSE 'open'
        END,
        updated_at = now()
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- Novo produto BST -> libera automaticamente para todos os alunos OPEN
CREATE OR REPLACE FUNCTION public.grant_new_bst_product_to_open_students()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active THEN
    INSERT INTO public.bst_product_access (user_id, product_id, source)
    SELECT DISTINCT sc.user_id, NEW.id, 'open_category'
    FROM public.student_categories sc
    JOIN public.student_category_defs d ON d.code = sc.code AND d.kind = 'open'
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bst_products_grant_open ON public.bst_products;
CREATE TRIGGER trg_bst_products_grant_open
AFTER INSERT OR UPDATE OF active ON public.bst_products
FOR EACH ROW EXECUTE FUNCTION public.grant_new_bst_product_to_open_students();

-- Novo curso -> libera automaticamente para todos os alunos OPEN
CREATE OR REPLACE FUNCTION public.grant_new_course_to_open_students()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_course_access (user_id, course_id, source)
  SELECT DISTINCT sc.user_id, NEW.id, 'open_category'
  FROM public.student_categories sc
  JOIN public.student_category_defs d ON d.code = sc.code AND d.kind = 'open'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_courses_grant_open ON public.courses;
CREATE TRIGGER trg_courses_grant_open
AFTER INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.grant_new_course_to_open_students();