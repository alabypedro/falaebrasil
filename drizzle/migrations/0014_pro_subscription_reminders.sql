CREATE OR REPLACE FUNCTION public.get_experience_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT jsonb_build_object(
       'active', true,
       'segment', e.segment,
       'started_at', e.started_at,
       'expires_at', e.expires_at,
       'days_left', greatest(0, ceil(extract(epoch FROM (e.expires_at - now())) / 86400))::int
     )
     FROM public.experience_access e
     WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.expires_at > now()
       AND NOT EXISTS (
         SELECT 1 FROM public.asaas_subscriptions s
         WHERE s.user_id = e.user_id AND lower(coalesce(s.status,'')) IN ('active','overdue')
       )
     LIMIT 1),
    jsonb_build_object('active', false)
  );
$function$;

CREATE TABLE public.subscription_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asaas_subscription_id text NOT NULL,
  kind text NOT NULL,
  due_date date NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'enviando',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_reminder_log TO authenticated;
GRANT ALL ON public.subscription_reminder_log TO service_role;
ALTER TABLE public.subscription_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read subscription reminder log"
  ON public.subscription_reminder_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));