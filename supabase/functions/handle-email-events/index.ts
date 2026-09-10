import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Mirrors the historical suppression records this project keeps for its own
// reporting. Notification-only: Lovable enforces suppression at send time.
async function recordOutcome(
  eventId: string,
  recipient: string,
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  logStatus: 'bounced' | 'complained' | 'suppressed',
  logMessage: string
) {
  const supabase = adminClient()
  const email = recipient.toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to record suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: logStatus,
    error_message: logMessage,
    metadata: null,
  })

  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('Failed to record send log')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordOutcome(
        event.event_id,
        event.data.recipient,
        'bounce',
        'bounced',
        'Permanent bounce — email address is invalid or rejected'
      )
    },
    'email.complaint': async (event) => {
      await recordOutcome(
        event.event_id,
        event.data.recipient,
        'complaint',
        'complained',
        'Spam complaint — recipient marked email as spam'
      )
    },
    'email.unsubscribed': async (event) => {
      await recordOutcome(
        event.event_id,
        event.data.recipient,
        'unsubscribe',
        'suppressed',
        'Recipient unsubscribed'
      )
    },
  },
})

Deno.serve((req) => handler(req))
