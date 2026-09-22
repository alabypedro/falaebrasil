ALTER VIEW public.xp_ranking SET (security_invoker = false);
GRANT SELECT ON public.xp_ranking TO authenticated;