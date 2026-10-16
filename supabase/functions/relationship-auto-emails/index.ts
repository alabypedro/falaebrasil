import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

// Sends only the onboarding emails (D0, D+1, D+3) to the buyer of a confirmed purchase.
// D+30 is a sales offer and stays a human contact.
const STEPS = [
  { day: 0, max: 0, heading: 'Seu acesso já está liberado' },
  { day: 1, max: 2, heading: 'Conseguiu entrar no produto?' },
  { day: 3, max: 5, heading: 'Uma dica para sua prática' },
]
const LINK = 'https://app.falaebrasil.com.br/library'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const cron = req.headers.get('x-cron-secret')
  if (cron) {
    const { data } = await admin.from('relationship_settings').select('value').eq('key', 'cron_secret').maybeSingle()
    if ((data?.value as { value?: string } | null)?.value !== cron) return json({ error: 'Unauthorized' }, 401)
  } else {
    const auth = req.headers.get('Authorization') ?? ''
    const { data: u } = await admin.auth.getUser(auth.replace('Bearer ', '').trim())
    if (!u?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: ok } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'admin' })
    if (!ok) return json({ error: 'Forbidden' }, 403)
  }

  const { data: tpls } = await admin.from('relationship_message_templates').select('day_offset, message, active, product_key').in('day_offset', [0, 1, 3]).is('product_key', null)
  const since = new Date(Date.now() - 6 * 86400_000).toISOString()
  const { data: pays } = await admin.from('asaas_payments').select('user_id, paid_at, created_at, status').not('user_id', 'is', null).in('status', ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']).gte('created_at', since)

  const last = new Map<string, number>()
  for (const p of pays ?? []) {
    const t = new Date(p.paid_at ?? p.created_at).getTime()
    if (t > (last.get(p.user_id) ?? 0)) last.set(p.user_id, t)
  }
  if (last.size === 0) return json({ sent: 0 })

  const ids = [...last.keys()]
  const [{ data: profs }, { data: rels }] = await Promise.all([
    admin.from('profiles').select('user_id, display_name, email').in('user_id', ids),
    admin.from('customer_relationships').select('user_id, stage').in('user_id', ids),
  ])
  let sent = 0
  for (const [uid, at] of last) {
    if (rels?.find((r) => r.user_id === uid)?.stage === 'sem_interesse') continue
    const prof = profs?.find((p) => p.user_id === uid)
    if (!prof?.email) continue
    const days = Math.floor((Date.now() - at) / 86400_000)
    const step = STEPS.find((s) => days >= s.day && days <= s.max)
    const tpl = tpls?.find((t) => t.day_offset === step?.day && t.active)
    if (!step || !tpl) continue
    const dateKey = new Date(at).toISOString().slice(0, 10)
    const key = `${uid}:d${step.day}:${dateKey}`
    const { error: dup } = await admin.from('relationship_email_log').insert({ user_id: uid, day_offset: step.day, dedupe_key: key, status: 'enviando' })
    if (dup) continue // already handled
    const first = (prof.display_name ?? '').trim().split(/\s+/)[0] || ''
    const message = tpl.message.replace(/^Oi,?\s*\[nome\]\.?\s*/i, '').replaceAll('[nome]', first)
    try {
      const r = await sendTemplateEmail('relationship-followup', prof.email, {
        templateData: { name: first, heading: step.heading, message, link: LINK },
        idempotencyKey: `relationship-followup-${key}`,
      })
      const status = r.sent ? 'enviado' : 'bloqueado'
      await admin.from('relationship_email_log').update({ status }).eq('dedupe_key', key)
      if (r.sent) {
        sent++
        await admin.from('customer_relationship_history').insert({ user_id: uid, type: 'email_automatico', channel: 'email', notes: `D${step.day === 0 ? '0' : '+' + step.day} enviado por e-mail: ${message}` })
        await admin.from('customer_relationships').upsert({ user_id: uid, last_contact_at: new Date().toISOString() }, { onConflict: 'user_id' })
      }
    } catch (e) {
      console.error('followup failed', { key, message: (e as Error).message })
      await admin.from('relationship_email_log').delete().eq('dedupe_key', key)
    }
  }
  return json({ sent })
})
