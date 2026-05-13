CREATE OR REPLACE FUNCTION public.tier_rank(_tier text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_tier,'open'))
    WHEN 'open' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'vip' THEN 3
    WHEN 'kids' THEN 0
    WHEN 'teens' THEN 0
    ELSE 1 END
$function$;