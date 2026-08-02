CREATE OR REPLACE FUNCTION public.has_open_category(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_categories sc
    JOIN public.student_category_defs d ON d.code = sc.code
    WHERE sc.user_id = _user_id AND d.kind = 'open'
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_open_category(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_course_access(_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_open_category(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_course_access
      WHERE user_id = auth.uid() AND course_id = _course_id
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE c.id = _course_id
        AND p.has_course_access = true
        AND public.tier_rank(p.plan_tier) >= public.tier_rank(c.required_tier)
    )
$$;

-- (backfill de profiles feito pelo app/admin)