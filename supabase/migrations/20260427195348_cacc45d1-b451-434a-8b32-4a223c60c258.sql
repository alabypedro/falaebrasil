-- Grant SELECT on the secure quiz questions view to authenticated users
-- The view excludes correct_option_index, so it's safe to expose
GRANT SELECT ON public.quiz_questions_public TO authenticated;

-- Ensure quizzes table is readable (already has policy, but ensure grant)
GRANT SELECT ON public.quizzes TO authenticated;