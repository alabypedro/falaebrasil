-- Enable the pg_net extension if it is not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- We need the project URL to call the edge function
-- Since we are in a migration, we can't easily get the dynamic URL, 
-- but we can use the net.http_post to call the function via the internal loopback or project ref.
-- However, the most reliable way in Lovable/Supabase context for edge functions is using the vault or standard naming.

-- Schedule the cron job to run every hour
-- Note: 'push-notifications-hourly' is the unique name for this job.
SELECT cron.schedule(
  'push-notifications-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://teastozdtgoogrpghpzj.supabase.co/functions/v1/push-notifications-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
      ),
      body := '{}'
    ) as request_id;
  $$
);

-- Grant permissions if necessary (usually service_role/postgres has it)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
