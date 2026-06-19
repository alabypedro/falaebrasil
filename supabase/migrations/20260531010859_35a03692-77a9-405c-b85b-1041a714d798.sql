-- 1) Join entre produto Hubla e cursos liberados
CREATE TABLE IF NOT EXISTS public.hubla_product_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_mapping_id uuid NOT NULL REFERENCES public.hubla_product_mapping(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_mapping_id, course_id)
);

GRANT SELECT ON public.hubla_product_courses TO authenticated;
GRANT ALL ON public.hubla_product_courses TO service_role;

ALTER TABLE public.hubla_product_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view product courses" ON public.hubla_product_courses;
  CREATE POLICY "Authenticated can view product courses"
  ON public.hubla_product_courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage product courses" ON public.hubla_product_courses;
  CREATE POLICY "Admins manage product courses"
  ON public.hubla_product_courses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Cursos concedidos por usuário (via compra Hubla ou admin)
CREATE TABLE IF NOT EXISTS public.user_course_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'hubla',
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_user_course_access_user ON public.user_course_access(user_id);

GRANT SELECT ON public.user_course_access TO authenticated;
GRANT ALL ON public.user_course_access TO service_role;

ALTER TABLE public.user_course_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own course access" ON public.user_course_access;
  CREATE POLICY "Users view own course access"
  ON public.user_course_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage course access" ON public.user_course_access;
  CREATE POLICY "Admins manage course access"
  ON public.user_course_access FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) Função helper para checar acesso a um curso específico
CREATE OR REPLACE FUNCTION public.has_course_access(_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
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