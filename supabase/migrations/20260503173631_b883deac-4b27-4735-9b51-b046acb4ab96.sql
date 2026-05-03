ALTER VIEW public.quiz_questions_public SET (security_invoker = off);
GRANT SELECT ON public.quiz_questions_public TO authenticated, anon;