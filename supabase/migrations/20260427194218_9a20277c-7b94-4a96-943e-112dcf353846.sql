
-- Fix mutable search_path on email helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;

-- Revoke EXECUTE from anon/authenticated on email queue helpers (service-role only)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;

-- Revoke EXECUTE from anon on SECURITY DEFINER functions intended for authenticated users only
REVOKE EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_course_progress(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_all_progress() FROM anon, PUBLIC;

-- Ensure authenticated retains EXECUTE on user-facing RPCs
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_course_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_progress() TO authenticated;
