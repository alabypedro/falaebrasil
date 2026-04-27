REVOKE ALL ON FUNCTION public.reset_course_progress(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.reset_all_progress() FROM public, anon;
REVOKE ALL ON FUNCTION public.calculate_level_from_xp(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_course_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_level_from_xp(integer) TO authenticated;