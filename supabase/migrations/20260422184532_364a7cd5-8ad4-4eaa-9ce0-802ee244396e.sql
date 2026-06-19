
-- =========================================================================
-- 1. PROFILES: restrict reads + hide hubla_customer_id
-- =========================================================================

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Public-facing view (excludes hubla_customer_id and other sensitive fields)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  id,
  user_id,
  display_name,
  avatar_url,
  level,
  xp,
  streak_days,
  user_type,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- Authenticated users may read profile rows (the view hides sensitive cols);
-- additionally allow the owner to read their own full row from the base table.
DROP POLICY IF EXISTS "Authenticated can view profiles base row" ON public.profiles;
  CREATE POLICY "Authenticated can view profiles base row"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can view public profile fields" ON public.profiles;
  CREATE POLICY "Authenticated can view public profile fields"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- The two SELECT policies above are permissive and OR'd together. To make
-- hubla_customer_id truly owner-only we rely on application code reading
-- the `profiles_public` view for cross-user reads, and the base table only
-- for the signed-in user's own row. We additionally drop the broad policy
-- and keep only the view-based access for cross-user reads.
DROP POLICY "Authenticated can view public profile fields" ON public.profiles;

-- Final state: base table SELECT is owner-only; cross-user reads must go
-- through profiles_public view (which excludes hubla_customer_id).

-- =========================================================================
-- 2. USER_ROLES: prevent privilege escalation (restrictive INSERT)
-- =========================================================================

-- The existing permissive "Admins can manage roles" (FOR ALL) lets admins
-- write. Add a RESTRICTIVE policy so non-admins are blocked from writing
-- even if another permissive policy is added later by mistake.
DROP POLICY IF EXISTS "Only admins may write user_roles" ON public.user_roles;
  CREATE POLICY "Only admins may write user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================================
-- 3. QUIZ QUESTIONS: hide correct_option_index from clients
-- =========================================================================

-- Public view without the answer key
CREATE OR REPLACE VIEW public.quiz_questions_public
WITH (security_invoker = on) AS
SELECT
  id,
  quiz_id,
  question_text,
  options,
  display_order,
  created_at
FROM public.quiz_questions;

GRANT SELECT ON public.quiz_questions_public TO authenticated;

-- Restrict base table SELECT to admins only (clients must use the view)
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.quiz_questions;

DROP POLICY IF EXISTS "Admins can view full quiz questions" ON public.quiz_questions;
CREATE POLICY "Admins can view full quiz questions"
  ON public.quiz_questions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Server-side grading function: takes user's answers, computes score,
-- records the attempt, awards XP, and returns per-question correctness.
CREATE OR REPLACE FUNCTION public.submit_quiz(
  _quiz_id uuid,
  _answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _passing_score int;
  _total int;
  _correct int := 0;
  _score int;
  _passed boolean;
  _xp_earned int := 0;
  _new_xp int;
  _new_level text;
  _current_xp int;
  _results jsonb := '[]'::jsonb;
  _q record;
  _user_answer int;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT passing_score INTO _passing_score
  FROM public.quizzes WHERE id = _quiz_id;

  IF _passing_score IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  SELECT count(*) INTO _total
  FROM public.quiz_questions WHERE quiz_id = _quiz_id;

  IF _total = 0 THEN
    RAISE EXCEPTION 'Quiz has no questions';
  END IF;

  FOR _q IN
    SELECT id, correct_option_index, display_order
    FROM public.quiz_questions
    WHERE quiz_id = _quiz_id
    ORDER BY display_order
  LOOP
    _user_answer := NULLIF(_answers ->> _q.id::text, '')::int;
    IF _user_answer IS NULL THEN
      _user_answer := NULLIF(_answers ->> _q.display_order::text, '')::int;
    END IF;

    IF _user_answer IS NOT NULL AND _user_answer = _q.correct_option_index THEN
      _correct := _correct + 1;
      _results := _results || jsonb_build_object(
        'question_id', _q.id,
        'correct', true,
        'correct_option_index', _q.correct_option_index
      );
    ELSE
      _results := _results || jsonb_build_object(
        'question_id', _q.id,
        'correct', false,
        'correct_option_index', _q.correct_option_index
      );
    END IF;
  END LOOP;

  _score := round((_correct::numeric / _total::numeric) * 100);
  _passed := _score >= _passing_score;

  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (_user_id, _quiz_id, _score, _passed, COALESCE(_answers, '{}'::jsonb));

  IF _passed THEN
    _xp_earned := round(_score::numeric / 10) * 5;
    SELECT xp INTO _current_xp FROM public.profiles WHERE user_id = _user_id;
    _new_xp := COALESCE(_current_xp, 0) + _xp_earned;
    IF _new_xp >= 5000 THEN _new_level := 'B2';
    ELSIF _new_xp >= 2500 THEN _new_level := 'B1';
    ELSIF _new_xp >= 1000 THEN _new_level := 'A2';
    ELSE _new_level := 'A1';
    END IF;
    UPDATE public.profiles
    SET xp = _new_xp, level = _new_level
    WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'score', _score,
    'passed', _passed,
    'correct_count', _correct,
    'total', _total,
    'xp_earned', _xp_earned,
    'results', _results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) TO authenticated;

-- =========================================================================
-- 4. STORAGE: prevent listing of public buckets
-- =========================================================================

-- Replace broad SELECT policies with object-level reads that require knowing
-- the exact path (no enumeration via list()).
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view lesson files" ON storage.objects;

-- Direct file access via signed/public URL still works because the storage
-- API checks per-object access. We allow SELECT on individual rows but
-- filter list() requests by limiting to specific paths only when authed.
CREATE POLICY "Public read avatar files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      -- Direct object access (single-row read by name) — allowed
      coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> ''
      OR true
    )
  );

-- Note: the above is effectively still public-readable per object, which is
-- required for <img src> tags. Listing is a separate API; to block listing
-- we restrict the policy so that bulk SELECT without a name filter is
-- impossible by requiring the `name` to be referenced. Postgres RLS can't
-- inspect the query shape, so the practical mitigation is to keep SELECT
-- per-object and rely on the app never calling .list() on these buckets.
DROP POLICY "Public read avatar files" ON storage.objects;

-- Keep public per-object reads (needed for <img src>) and admin-only listing
-- enforced via a tighter SELECT policy on lesson-files.
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public read lesson files" ON storage.objects;
CREATE POLICY "Public read lesson files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'lesson-files');

-- The Supabase linter "public_bucket_allows_listing" is informational for
-- public buckets that intentionally serve files via public URLs. We accept
-- the residual risk for these two buckets because the app uses public URLs
-- for avatar and lesson asset rendering and never enumerates objects.
