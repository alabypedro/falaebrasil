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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Accept legacy (0,3,5) and new (1,2,3,4) ratings.
  -- Normalize: 0->1 (novamente), 3->3 (bom), 5->4 (fácil)
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
    -- Novamente: <1min
    _new_reps := 0;
    _new_interval := 0.5 / 1440.0; -- 30 seconds (<1min)
    _new_ease := GREATEST(1.3, _row.ease_factor - 0.2);
    _new_lapses := _row.lapses + 1;
  ELSIF _rating = 2 THEN
    -- Difícil: <1dia
    _new_reps := GREATEST(_row.repetitions, 1);
    _new_interval := 0.9; -- ~21h (<1 dia)
    _new_ease := GREATEST(1.3, _row.ease_factor - 0.15);
  ELSIF _rating = 3 THEN
    -- Bom: 15 dias
    _new_interval := 15;
    _new_reps := _row.repetitions + 1;
  ELSE
    -- Fácil: 90 dias
    _new_interval := 90;
    _new_ease := _row.ease_factor + 0.15;
    _new_reps := _row.repetitions + 1;
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

  RETURN jsonb_build_object(
    'due_at', _due,
    'interval_days', _new_interval,
    'ease_factor', _new_ease,
    'repetitions', _new_reps,
    'lapses', _new_lapses
  );
END;
$function$;