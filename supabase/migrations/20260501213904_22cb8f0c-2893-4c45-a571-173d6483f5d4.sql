-- Fix typo in product ID (was '7YNOATVITU1bdajeEUGU' lowercase 'e', Hubla sends 'E')
UPDATE public.voice_credit_products
SET hubla_product_id = '7YNOATVITU1bdajEeUGU'
WHERE hubla_product_id = '7YNOATVITU1bdajeEUGU';

-- Make grant_voice_credits case-insensitive on the product id lookup
CREATE OR REPLACE FUNCTION public.grant_voice_credits(
  _user_id uuid,
  _hubla_event_id text,
  _hubla_product_id text,
  _raw_payload jsonb DEFAULT NULL::jsonb
)
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