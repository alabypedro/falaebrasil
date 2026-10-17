import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

// Lembretes amigáveis da mensalidade do Plano PRO:
// D-3, D-1 e D0 antes do vencimento, e aviso de pagamento em atraso.
// Roda uma vez ao dia; cada envio é deduplicado por assinatura + tipo + vencimento.
const LINK = 'https://app.falaebrasil.com.br'

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

type Reminder = { kind: string; heading: string; message: (due: string) => string }

const REMINDERS: Reminder[] = [
  {
    kind: 'd3',
    heading: 'Sua mensalidade vence em 3 dias',
    message: (due) =>
      `Passando para lembrar que a mensalidade do seu Plano PRO vence em ${due}. A cobrança é automática no cartão ou no Pix Automático — você não precisa fazer nada. Bom treino!`,
  },
  {
    kind: 'd1',
    heading: 'Sua mensalidade vence amanhã',
    message: (due) =>
      `Amanhã (${due}) é o vencimento da mensalidade do seu Plano PRO. A cobrança acontece automaticamente, sem precisar copiar e colar Pix. Qualquer dúvida, é só responder este e-mail.`,
  },
  {
    kind: 'd0',
    heading: 'Hoje é o dia da renovação do seu Plano PRO',
    message: (due) =>
      `Hoje (${due}) renovamos sua assinatura do Plano PRO. A cobrança é feita automaticamente e seu acesso continua liberado normalmente. Obrigado por seguir com a gente!`,
  },
  {
    kind: 'overdue',
    heading: 'Não conseguimos confirmar seu pagamento',
    message: () =>
      `A mensalidade do seu Plano PRO ficou pendente. Para não perder o acesso aos cursos, regularize o pagamento pelo link que você recebeu no ato da assinatura ou fale com a gente respondendo este e-mail.`,
  },
]

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

  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const inDays = (n: number) => iso(new Date(today.getTime() + n * 86400_000))

  const { data: subs } = await admin
    .from('asaas_subscriptions')
    .select('asaas_subscription_id, user_id, status, next_due_date, value_cents, product_key')
    .not('user_id', 'is', null)
  if (!subs?.length) return json({ sent: 0 })

  const userIds = [...new Set(subs.map((s) => s.user_id as string))]
  const { data: profs } = await admin.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
  const profBy = new Map((profs ?? []).map((p) => [p.user_id, p]))

  let sent = 0
  for (const sub of subs) {
    const status = String(sub.status ?? '').toLowerCase()
    const due = sub.next_due_date as string | null
    if (!due) continue

    let reminder: Reminder | null = null
    if (status === 'overdue') {
      reminder = REMINDERS.find((r) => r.kind === 'overdue')!
    } else if (status === 'active') {
      if (due === inDays(3)) reminder = REMINDERS.find((r) => r.kind === 'd3')!
      else if (due === inDays(1)) reminder = REMINDERS.find((r) => r.kind === 'd1')!
      else if (due === iso(today)) reminder = REMINDERS.find((r) => r.kind === 'd0')!
    }
    if (!reminder) continue

    const prof = profBy.get(sub.user_id as string)
    if (!prof?.email) continue

    const key = `${sub.asaas_subscription_id}:${reminder.kind}:${due}`
    const { error: dup } = await admin.from('subscription_reminder_log').insert({
      user_id: sub.user_id,
      asaas_subscription_id: sub.asaas_subscription_id,
      kind: reminder.kind,
      due_date: due,
      dedupe_key: key,
      status: 'enviando',
    })
    if (dup) continue // já enviado para este vencimento

    const first = (prof.display_name ?? '').trim().split(/\s+/)[0] || ''
    try {
      const r = await sendTemplateEmail('relationship-followup', prof.email, {
        templateData: { name: first, heading: reminder.heading, message: reminder.message(fmtDate(due)), link: LINK },
        idempotencyKey: `subscription-reminder-${key}`,
      })
      const st = r.sent ? 'enviado' : 'bloqueado'
      await admin.from('subscription_reminder_log').update({ status: st }).eq('dedupe_key', key)
      if (r.sent) sent++
    } catch (e) {
      console.error('reminder failed', { key, message: (e as Error).message })
      await admin.from('subscription_reminder_log').delete().eq('dedupe_key', key)
    }
  }

  return json({ sent })
})
