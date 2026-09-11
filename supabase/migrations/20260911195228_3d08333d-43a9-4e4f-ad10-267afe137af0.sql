CREATE POLICY "Block users from setting protected fields on insert"
ON public.profiles
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR (
    has_course_access = false
    AND has_ebook1_access = false
    AND has_ebook2_access = false
    AND has_ebook3_access = false
    AND has_a2_access = false
    AND has_b1_access = false
    AND has_b2_access = false
    AND has_books_access = false
    AND scripted_balance = 0
    AND unscripted_balance = 0
    AND xp = 0
    AND streak_days = 0
    AND plan_tier = 'FREE'
    AND user_type = 'student'
    AND subscription_status = 'none'
    AND subscription_current_period_end IS NULL
    AND subscription_grace_until IS NULL
    AND hubla_customer_id IS NULL
    AND hubla_subscription_id IS NULL
    AND asaas_customer_id IS NULL
    AND asaas_subscription_id IS NULL
    AND best_scripted_score IS NULL
    AND best_unscripted_score IS NULL
    AND best_listening_score IS NULL
    AND best_writing_score IS NULL
  )
);