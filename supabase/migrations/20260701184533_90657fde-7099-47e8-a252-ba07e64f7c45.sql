
-- 1) DECKS
CREATE TABLE public.memorize_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  target_topic text NOT NULL DEFAULT 'geral' CHECK (target_topic IN ('vocabulario_infinito','agilidade_mental','foco_dificil','geral')),
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.memorize_decks TO authenticated;
GRANT ALL ON public.memorize_decks TO service_role;
ALTER TABLE public.memorize_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read decks" ON public.memorize_decks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage decks" ON public.memorize_decks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_memorize_decks_updated BEFORE UPDATE ON public.memorize_decks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) CARDS
CREATE TABLE public.memorize_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.memorize_decks(id) ON DELETE CASCADE,
  front_text text NOT NULL,
  back_text text NOT NULL,
  example_sentence text,
  audio_url text,
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.memorize_cards TO authenticated;
GRANT ALL ON public.memorize_cards TO service_role;
ALTER TABLE public.memorize_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read cards" ON public.memorize_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cards" ON public.memorize_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_memorize_cards_updated BEFORE UPDATE ON public.memorize_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_memorize_cards_deck ON public.memorize_cards(deck_id, display_order);

-- 3) USER REVIEWS (SRS state)
CREATE TABLE public.user_card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.memorize_cards(id) ON DELETE CASCADE,
  ease_factor numeric NOT NULL DEFAULT 2.5,
  interval_days numeric NOT NULL DEFAULT 0,
  repetitions int NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  last_rating smallint,
  lapses int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_card_reviews TO authenticated;
GRANT ALL ON public.user_card_reviews TO service_role;
ALTER TABLE public.user_card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own reviews" ON public.user_card_reviews FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User inserts own reviews" ON public.user_card_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "User updates own reviews" ON public.user_card_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "User deletes own reviews" ON public.user_card_reviews FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_user_card_reviews_updated BEFORE UPDATE ON public.user_card_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_user_card_reviews_due ON public.user_card_reviews(user_id, due_at);

-- 4) SM-2 function
CREATE OR REPLACE FUNCTION public.submit_card_review(_card_id uuid, _rating int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  IF _rating NOT IN (0,3,5) THEN RAISE EXCEPTION 'Invalid rating'; END IF;

  SELECT * INTO _row FROM public.user_card_reviews WHERE user_id=_uid AND card_id=_card_id;

  IF _row.id IS NULL THEN
    _row.ease_factor := 2.5;
    _row.interval_days := 0;
    _row.repetitions := 0;
    _row.lapses := 0;
  END IF;

  _new_ease := _row.ease_factor;
  _new_lapses := _row.lapses;

  IF _rating = 0 THEN
    _new_reps := 0;
    _new_interval := 1.0/1440.0 * 10; -- 10 minutes expressed as fraction of a day
    _new_ease := GREATEST(1.3, _row.ease_factor - 0.2);
    _new_lapses := _row.lapses + 1;
  ELSIF _rating = 3 THEN
    IF _row.repetitions = 0 THEN _new_interval := 1;
    ELSIF _row.repetitions = 1 THEN _new_interval := 3;
    ELSE _new_interval := round(_row.interval_days * _row.ease_factor);
    END IF;
    _new_reps := _row.repetitions + 1;
  ELSE -- 5 Fácil
    _new_ease := _row.ease_factor + 0.15;
    IF _row.repetitions = 0 THEN _new_interval := 4;
    ELSIF _row.repetitions = 1 THEN _new_interval := 6;
    ELSE _new_interval := round(_row.interval_days * _new_ease);
    END IF;
    _new_reps := _row.repetitions + 1;
  END IF;

  _due := now() + make_interval(mins => (_new_interval * 1440)::int);

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
$$;
