DO $$
DECLARE _s int; _u int;
BEGIN
  PERFORM set_config('app.bypass_profile_protection','on', true);

  WITH dupes AS (
    SELECT id, scripted_seconds_added, unscripted_seconds_added,
           row_number() OVER (PARTITION BY hubla_product_id ORDER BY created_at) AS rn
    FROM public.voice_credit_grants
    WHERE user_id = 'b2164660-ab54-4204-9fc7-ce84f531170e'
  ), removed AS (
    DELETE FROM public.voice_credit_grants
    WHERE id IN (SELECT id FROM dupes WHERE rn > 1)
    RETURNING scripted_seconds_added, unscripted_seconds_added
  )
  SELECT COALESCE(SUM(scripted_seconds_added),0), COALESCE(SUM(unscripted_seconds_added),0)
    INTO _s, _u FROM removed;

  UPDATE public.profiles
    SET scripted_balance = GREATEST(0, scripted_balance - _s),
        unscripted_balance = GREATEST(0, unscripted_balance - _u)
  WHERE user_id = 'b2164660-ab54-4204-9fc7-ce84f531170e';
END $$;