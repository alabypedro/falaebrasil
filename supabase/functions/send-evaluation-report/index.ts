import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const TEMPLATE_NAME = 'evaluation-report'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.slice('Bearer '.length).trim()
  )
  // The recipient is always the authenticated user's own address — never a
  // value taken from the request body.
  const recipient = userData?.user?.email
  if (userError || !recipient) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let templateData: Record<string, unknown> = {}
  try {
    const body = await req.json()
    if (body?.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  const idempotencyKey =
    typeof (templateData as { idempotencyKey?: unknown }).idempotencyKey === 'string'
      ? String((templateData as { idempotencyKey?: unknown }).idempotencyKey)
      : `${TEMPLATE_NAME}-${userData.user.id}-${Date.now()}`

  const logAttempt = async (
    status: 'sent' | 'suppressed' | 'failed',
    errorMessage?: string
  ) => {
    const { error } = await admin.from('email_send_log').insert({
      message_id: null,
      template_name: TEMPLATE_NAME,
      recipient_email: recipient,
      status,
      error_message: errorMessage ?? null,
    })
    if (error) {
      console.error('Failed to write email_send_log', {
        code: error.code,
        message: error.message,
      })
    }
  }

  try {
    const result = await sendTemplateEmail(TEMPLATE_NAME, recipient, {
      templateData,
      idempotencyKey,
    })

    if (!result.sent) {
      await logAttempt('suppressed')
      return json({ success: false, reason: 'recipient_suppressed' })
    }

    await logAttempt('sent')
    return json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to send evaluation report email', { message })
    await logAttempt('failed', message.slice(0, 1000))
    return json({ error: 'Failed to send email' }, 500)
  }
})
