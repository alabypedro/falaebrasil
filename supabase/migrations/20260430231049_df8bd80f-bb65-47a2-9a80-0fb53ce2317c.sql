
-- 1) Add balance columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scripted_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unscripted_balance integer NOT NULL DEFAULT 0;

-- 2) Voice credit product mapping (separate from hubla_product_mapping to keep concerns clean)
CREATE TABLE IF NOT EXISTS public.voice_credit_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hubla_product_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  scripted_seconds integer NOT NULL DEFAULT 0,
  unscripted_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_credit_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view voice credit products" ON public.voice_credit_products;
  CREATE POLICY "Authenticated can view voice credit products"
  ON public.voice_credit_products FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage voice credit products" ON public.voice_credit_products;
  CREATE POLICY "Admins can manage voice credit products"
  ON public.voice_credit_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER trg_voice_credit_products_updated_at
  BEFORE UPDATE ON public.voice_credit_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 4 products
INSERT INTO public.voice_credit_products (hubla_product_id, display_name, scripted_seconds, unscripted_seconds)
VALUES
  ('7YNOATVITU1bdajeEUGU', 'Essencial Pro A1', 600, 300),
  ('BiAELgn1wGL769DhVBz3', 'Anfitrião Soberano', 600, 300),
  ('fBKek3TTqjku4NvYZJjE', 'O Decodificador de Gringo', 600, 300),
  ('3cb0l2uslWtLQM7Kvtry', 'O Vocabulário de Poder', 600, 300)
ON CONFLICT (hubla_product_id) DO NOTHING;

-- 3) Idempotency log: one row per (hubla_event_id, hubla_product_id) credited
CREATE TABLE IF NOT EXISTS public.voice_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hubla_event_id text NOT NULL,
  hubla_product_id text NOT NULL,
  scripted_seconds_added integer NOT NULL DEFAULT 0,
  unscripted_seconds_added integer NOT NULL DEFAULT 0,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hubla_event_id, hubla_product_id)
);

ALTER TABLE public.voice_credit_grants ENABLE ROW LEVEL SECURITY;

-- Only service role writes; users can read their own grants (history)
DROP POLICY IF EXISTS "Users can view own voice credit grants" ON public.voice_credit_grants;
  CREATE POLICY "Users can view own voice credit grants"
  ON public.voice_credit_grants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages voice credit grants" ON public.voice_credit_grants;
  CREATE POLICY "Service role manages voice credit grants"
  ON public.voice_credit_grants FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_voice_credit_grants_user ON public.voice_credit_grants(user_id);

-- 4) Debit functions (SECURITY DEFINER, callable from authenticated client)
CREATE OR REPLACE FUNCTION public.debit_scripted_seconds(_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _current integer;
  _to_debit integer;
  _new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _seconds IS NULL OR _seconds <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', NULL);
  END IF;

  SELECT scripted_balance INTO _current FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF _current IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF _current <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', 0, 'insufficient', true);
  END IF;

  _to_debit := LEAST(_seconds, _current);
  _new_balance := _current - _to_debit;

  UPDATE public.profiles SET scripted_balance = _new_balance WHERE user_id = _user_id;

  RETURN jsonb_build_object('debited', _to_debit, 'balance', _new_balance, 'insufficient', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_unscripted_seconds(_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _current integer;
  _to_debit integer;
  _new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _seconds IS NULL OR _seconds <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', NULL);
  END IF;

  SELECT unscripted_balance INTO _current FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF _current IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF _current <= 0 THEN
    RETURN jsonb_build_object('debited', 0, 'balance', 0, 'insufficient', true);
  END IF;

  _to_debit := LEAST(_seconds, _current);
  _new_balance := _current - _to_debit;

  UPDATE public.profiles SET unscripted_balance = _new_balance WHERE user_id = _user_id;

  RETURN jsonb_build_object('debited', _to_debit, 'balance', _new_balance, 'insufficient', false);
END;
$$;

-- 5) Grant function called from the Hubla webhook (service role only).
-- Idempotent via UNIQUE (hubla_event_id, hubla_product_id).
CREATE OR REPLACE FUNCTION public.grant_voice_credits(
  _user_id uuid,
  _hubla_event_id text,
  _hubla_product_id text,
  _raw_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scripted integer;
  _unscripted integer;
  _inserted_id uuid;
BEGIN
  SELECT scripted_seconds, unscripted_seconds
    INTO _scripted, _unscripted
  FROM public.voice_credit_products
  WHERE hubla_product_id = _hubla_product_id;

  IF _scripted IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_product');
  END IF;

  BEGIN
    INSERT INTO public.voice_credit_grants
      (user_id, hubla_event_id, hubla_product_id, scripted_seconds_added, unscripted_seconds_added, raw_payload)
    VALUES
      (_user_id, _hubla_event_id, _hubla_product_id, _scripted, _unscripted, _raw_payload)
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
$$;
