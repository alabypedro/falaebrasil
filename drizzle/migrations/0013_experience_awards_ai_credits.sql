-- A experiência de 30 dias inclui 1 hora de treino com as IAs, no mesmo padrão dos Guias BST.
CREATE OR REPLACE FUNCTION public.grant_experience_access(_user_id uuid, _segment text, _asaas_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _row public.experience_access;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _user_id IS NULL OR _segment NOT IN ('adults','kids_teens') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid_input');
  END IF;

  SELECT * INTO _row FROM public.experience_access WHERE user_id = _user_id;
  IF _row.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'already_used',
      'segment', _row.segment,
      'expires_at', _row.expires_at,
      'original_payment_id', _row.asaas_payment_id
    );
  END IF;

  INSERT INTO public.experience_access (user_id, segment, started_at, expires_at, asaas_payment_id)
  VALUES (_user_id, _segment, now(), now() + interval '30 days', _asaas_payment_id)
  RETURNING * INTO _row;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  UPDATE public.profiles
     SET scripted_balance = scripted_balance + 3600,
         updated_at = now()
   WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'granted', true,
    'segment', _row.segment,
    'started_at', _row.started_at,
    'expires_at', _row.expires_at,
    'credits_seconds', 3600
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.grant_experience_access(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_experience_access(uuid, text, text) TO service_role;