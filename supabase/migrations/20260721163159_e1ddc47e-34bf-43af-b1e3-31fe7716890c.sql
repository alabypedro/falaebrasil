REVOKE ALL ON FUNCTION public.grant_access_from_asaas(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_access_from_asaas(uuid, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.grant_access_from_asaas(uuid, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_access_from_asaas(uuid, text, text, jsonb) TO service_role;