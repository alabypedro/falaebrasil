
-- 1) grant_voice_credits: restrict to service role only
REVOKE EXECUTE ON FUNCTION public.grant_voice_credits(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_voice_credits(uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_voice_credits(uuid, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_voice_credits(uuid, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_voice_credits(_user_id uuid, _hubla_event_id text, _hubla_product_id text, _raw_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _scripted integer;
  _unscripted integer;
  _inserted_id uuid;
  _matched_product_id text;
BEGIN
  -- Only service role (webhook / admin backend) may call this
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT hubla_product_id, scripted_seconds, unscripted_seconds
    INTO _matched_product_id, _scripted, _unscripted
  FROM public.voice_credit_products
  WHERE lower(hubla_product_id) = lower(_hubla_product_id)
  LIMIT 1;

  IF _scripted IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_product');
  END IF;

  BEGIN
    INSERT INTO public.voice_credit_grants
      (user_id, hubla_event_id, hubla_product_id, scripted_seconds_added, unscripted_seconds_added, raw_payload)
    VALUES
      (_user_id, _hubla_event_id, _matched_product_id, _scripted, _unscripted, _raw_payload)
    RETURNING id INTO _inserted_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_processed');
  END;

  UPDATE public.profiles
    SET scripted_balance = scripted_balance + _scripted,
        unscripted_balance = unscripted_balance + _unscripted
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'granted', true,
    'scripted_added', _scripted,
    'unscripted_added', _unscripted,
    'grant_id', _inserted_id
  );
END;
$function$;

-- 2) Courses: limit non-admins to published courses
DROP POLICY IF EXISTS "Authenticated can view all courses" ON public.courses;
CREATE POLICY "View courses (published or admin)" ON public.courses
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR published = true
);

-- 3) Modules: restrict to admins or users with access to parent course
DROP POLICY IF EXISTS "Anyone authenticated can view modules" ON public.modules;
CREATE POLICY "View modules with course access" ON public.modules
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_course_access(course_id)
);

-- 4) Lessons: restrict via parent module -> course access
DROP POLICY IF EXISTS "Authenticated can view lessons" ON public.lessons;
CREATE POLICY "View lessons with course access" ON public.lessons
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = lessons.module_id
      AND public.has_course_access(m.course_id)
  )
);

-- 5) Lesson videos: restrict via parent lesson -> module -> course
DROP POLICY IF EXISTS "Authenticated can view lesson videos" ON public.lesson_videos;
CREATE POLICY "View lesson videos with course access" ON public.lesson_videos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE l.id = lesson_videos.lesson_id
      AND public.has_course_access(m.course_id)
  )
);

-- 6) Quizzes: restrict via lesson -> module -> course
DROP POLICY IF EXISTS "Anyone authenticated can view quizzes" ON public.quizzes;
CREATE POLICY "View quizzes with course access" ON public.quizzes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE l.id = quizzes.lesson_id
      AND public.has_course_access(m.course_id)
  )
);

-- 7) Leiae texts: admins, global (course_id IS NULL) available to all authenticated, else require course access
DROP POLICY IF EXISTS "Anyone authenticated can read leiae texts" ON public.leiae_texts;
CREATE POLICY "View leiae texts with course access" ON public.leiae_texts
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR course_id IS NULL
  OR public.has_course_access(course_id)
);

-- 8) Memorize decks: same rule
DROP POLICY IF EXISTS "Auth users can read decks" ON public.memorize_decks;
CREATE POLICY "View memorize decks with course access" ON public.memorize_decks
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR course_id IS NULL
  OR public.has_course_access(course_id)
);

-- 9) Memorize cards: via parent deck
DROP POLICY IF EXISTS "Auth users can read cards" ON public.memorize_cards;
CREATE POLICY "View memorize cards with deck access" ON public.memorize_cards
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.memorize_decks d
    WHERE d.id = memorize_cards.deck_id
      AND (d.course_id IS NULL OR public.has_course_access(d.course_id))
  )
);
