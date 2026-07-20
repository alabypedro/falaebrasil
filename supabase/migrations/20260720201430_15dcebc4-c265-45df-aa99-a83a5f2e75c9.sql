
ALTER TABLE public.asaas_webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS result jsonb;

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_processed_at ON public.asaas_webhook_events (processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_payment_id ON public.asaas_webhook_events (payment_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_subscription_id ON public.asaas_webhook_events (subscription_id);
