import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const APP_URL = 'https://app.falaebrasil.com.br/admin/relationship'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Cliente'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service)

  // Authorization: cron (shared secret stored in admin-only settings) or an admin JWT.
  let manual = false
  const cronHeader = req.headers.get('x-cron-secret')
  if (cronHeader) {
    const { data } = await admin.from('relationship_settings').select('value').eq('key', 'cron_secret').maybeSingle()
    const secret = (data?.value as { value?: string } | null)?.value
    if (!secret || secret !== cronHeader) return json({ error: 'Unauthorized' }, 401)
  } else {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const { data: u } = await admin.auth.getUser(auth.slice(7).trim())
    if (!u?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'admin' })
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)
    manual = true
  }

  const { data: setting } = await admin.from('relationship_settings').select('value').eq('key', 'default_responsible').maybeSingle()
  const responsibleId = (setting?.value as { user_id?: string } | null)?.user_id
  if (!responsibleId) return json({ success: false, reason: 'no_default_responsible' })

  const { data: resp } = await admin.from('profiles').select('display_name, email').eq('user_id', responsibleId).maybeSingle()
  if (!resp?.email) return json({ success: false, reason: 'responsible_without_email' })

  // Tomorrow 00:00 in America/Sao_Paulo (UTC-3)
  const nowSp = new Date(Date.now() - 3 * 3600_000)
  const startSp = Date.UTC(nowSp.getUTCFullYear(), nowSp.getUTCMonth(), nowSp.getUTCDate()) + 3 * 3600_000
  const endSp = startSp + 86400_000

  const { data: tasks } = await admin
    .from('relationship_tasks')
    .select('user_id, reason, priority, due_at')
    .in('status', ['pendente', 'adiada'])
    .lt('due_at', new Date(endSp).toISOString())
    .or(`responsible_id.eq.${responsibleId},responsible_id.is.null`)
    .order('due_at')

  const list = tasks ?? []
  const overdue = list.filter((t) => new Date(t.due_at).getTime() < startSp).length
  const today = list.length - overdue
  const ids = [...new Set(list.map((t) => t.user_id))]
  const { data: profs } = ids.length
    ? await admin.from('profiles').select('user_id, display_name').in('user_id', ids)
    : { data: [] as { user_id: string; display_name: string | null }[] }
  const nameOf = (id: string) => initials(profs?.find((p) => p.user_id === id)?.display_name)
  const rank: Record<string, number> = { alta: 0, normal: 1, baixa: 2 }
  const items = [...list]
    .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3))
    .slice(0, 10)
    .map((t) => ({ name: nameOf(t.user_id), reason: t.reason, priority: t.priority, overdue: new Date(t.due_at).getTime() < startSp }))

  const dateLabel = new Date(startSp).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  try {
    const result = await sendTemplateEmail('relationship-daily-summary', resp.email, {
      templateData: { recipientName: (resp.display_name ?? '').split(' ')[0], dateLabel, today, overdue, items, link: APP_URL },
      idempotencyKey: manual ? `relationship-summary-${responsibleId}-${Date.now()}` : `relationship-summary-${responsibleId}-${dateLabel}`,
    })
    return json({ success: result.sent, today, overdue, recipient: resp.email })
  } catch (e) {
    console.error('relationship summary failed', { message: (e as Error).message })
    return json({ error: 'Falha ao enviar o resumo' }, 500)
  }
})
