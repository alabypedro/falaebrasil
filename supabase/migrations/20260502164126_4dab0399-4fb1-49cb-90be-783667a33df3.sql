DO $$
DECLARE
  _user_id uuid;
  _scripted_to_remove int := 0;
  _unscripted_to_remove int := 0;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email='projetojoisalaby@gmail.com';
  IF _user_id IS NULL THEN RAISE NOTICE 'user not found, skipping'; RETURN; END IF;

  SELECT
    COALESCE(SUM(scripted_seconds_added), 0),
    COALESCE(SUM(unscripted_seconds_added), 0)
  INTO _scripted_to_remove, _unscripted_to_remove
  FROM public.voice_credit_grants
  WHERE user_id = _user_id
    AND id NOT IN (
      SELECT DISTINCT ON (hubla_product_id) id
      FROM public.voice_credit_grants
      WHERE user_id = _user_id
      ORDER BY hubla_product_id, created_at ASC
    );

  DELETE FROM public.voice_credit_grants
  WHERE user_id = _user_id
    AND id NOT IN (
      SELECT DISTINCT ON (hubla_product_id) id
      FROM public.voice_credit_grants
      WHERE user_id = _user_id
      ORDER BY hubla_product_id, created_at ASC
    );

  UPDATE public.profiles
  SET scripted_balance = GREATEST(0, scripted_balance - _scripted_to_remove),
      unscripted_balance = GREATEST(0, unscripted_balance - _unscripted_to_remove)
  WHERE user_id = _user_id;

  RAISE NOTICE 'Removed % scripted seconds and % unscripted seconds for %', _scripted_to_remove, _unscripted_to_remove, _user_id;
END $$;