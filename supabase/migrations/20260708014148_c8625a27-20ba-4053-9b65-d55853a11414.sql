
-- Stop double-tracking: AI XP lives only in ai_xp_events; dashboard adds it to profile.xp for display.

CREATE OR REPLACE FUNCTION public.award_ai_xp(_source text, _points int, _key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted_id uuid;
  _ai_total int;
  _profile_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _source NOT IN ('memorizae','leiae','falae','escutae','escreveae') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;
  IF _points IS NULL OR _points < 0 OR _points > 500 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;
  IF _key IS NULL OR length(_key) = 0 THEN RAISE EXCEPTION 'Invalid key'; END IF;

  INSERT INTO public.ai_xp_events(user_id, source, points, key)
  VALUES (_uid, _source, _points, _key)
  ON CONFLICT (user_id, key) DO NOTHING
  RETURNING id INTO _inserted_id;

  SELECT COALESCE(SUM(points),0) INTO _ai_total FROM public.ai_xp_events WHERE user_id = _uid;
  SELECT COALESCE(xp,0) INTO _profile_xp FROM public.profiles WHERE id = _uid;

  RETURN jsonb_build_object(
    'awarded', _inserted_id IS NOT NULL,
    'points', CASE WHEN _inserted_id IS NOT NULL THEN _points ELSE 0 END,
    'total_xp', _profile_xp + _ai_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_card_review(_card_id uuid, _rating integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_card_reviews;
  _new_ease numeric;
  _new_interval numeric;
  _new_reps int;
  _new_lapses int;
  _due timestamptz;
  _xp int := 0;
  _key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _rating = 0 THEN _rating := 1;
  ELSIF _rating = 5 THEN _rating := 4;
  END IF;
  IF _rating NOT IN (1,2,3,4) THEN RAISE EXCEPTION 'Invalid rating'; END IF;

  SELECT * INTO _row FROM public.user_card_reviews WHERE user_id=_uid AND card_id=_card_id;

  IF _row.id IS NULL THEN
    _row.ease_factor := 2.5;
    _row.interval_days := 0;
    _row.repetitions := 0;
    _row.lapses := 0;
  END IF;

  _new_ease := _row.ease_factor;
  _new_lapses := _row.lapses;

  IF _rating = 1 THEN
    _new_reps := 0;
    _new_interval := 0.5 / 1440.0;
    _new_ease := GREATEST(1.3, _row.ease_factor - 0.2);
    _new_lapses := _row.lapses + 1;
    _xp := 0;
  ELSIF _rating = 2 THEN
    _new_reps := GREATEST(_row.repetitions, 1);
    _new_interval := 0.9;
    _new_ease := GREATEST(1.3, _row.ease_factor - 0.15);
    _xp := 5;
  ELSIF _rating = 3 THEN
    _new_interval := 15;
    _new_reps := _row.repetitions + 1;
    _xp := 10;
  ELSE
    _new_interval := 90;
    _new_ease := _row.ease_factor + 0.15;
    _new_reps := _row.repetitions + 1;
    _xp := 25;
  END IF;

  _due := now() + make_interval(mins => GREATEST(1, (_new_interval * 1440)::int));

  INSERT INTO public.user_card_reviews
    (user_id, card_id, ease_factor, interval_days, repetitions, due_at, last_reviewed_at, last_rating, lapses)
  VALUES
    (_uid, _card_id, _new_ease, _new_interval, _new_reps, _due, now(), _rating, _new_lapses)
  ON CONFLICT (user_id, card_id) DO UPDATE SET
    ease_factor = EXCLUDED.ease_factor,
    interval_days = EXCLUDED.interval_days,
    repetitions = EXCLUDED.repetitions,
    due_at = EXCLUDED.due_at,
    last_reviewed_at = EXCLUDED.last_reviewed_at,
    last_rating = EXCLUDED.last_rating,
    lapses = EXCLUDED.lapses;

  IF _xp > 0 THEN
    _key := 'memorizae:' || _card_id::text || ':' || replace(gen_random_uuid()::text,'-','');
    INSERT INTO public.ai_xp_events(user_id, source, points, key)
    VALUES (_uid, 'memorizae', _xp, _key)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'due_at', _due,
    'interval_days', _new_interval,
    'ease_factor', _new_ease,
    'repetitions', _new_reps,
    'lapses', _new_lapses,
    'xp_earned', _xp
  );
END;
$function$;

-- Remove AI XP already added to profiles.xp to avoid double count now that dashboard sums both.
UPDATE public.profiles p
SET xp = GREATEST(0, COALESCE(p.xp,0) - COALESCE(sub.total,0))
FROM (
  SELECT user_id, SUM(points)::int AS total
  FROM public.ai_xp_events
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id;
