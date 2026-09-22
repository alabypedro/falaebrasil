import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const TEMPLATE_NAME = 'student-progress-report'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const fmtGrade = (v?: number | null) =>
  v === null || v === undefined ? '—' : `${Number(v).toFixed(0)}%`

const AI_LABELS: Record<string, string> = {
  memorizae: 'IA Memorizaê',
  escutae: 'IA Escutaê',
  falae: 'IA Falaê',
  leiae: 'IA Leiaê',
  escreveae: 'IA Escreveaê',
  musiclab: 'Cantaê',
  books: 'Estórias Curtas',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice('Bearer '.length).trim()

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  const caller = userData?.user
  if (userError || !caller) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: isAdmin } = await admin.rpc('has_role', {
    _user_id: caller.id,
    _role: 'admin',
  })
  if (!isAdmin) {
    return json({ error: 'Forbidden' }, 403)
  }

  let studentId = ''
  let sendToMe = false
  try {
    const body = await req.json()
    studentId = typeof body?.studentId === 'string' ? body.studentId : ''
    sendToMe = body?.recipient === 'me'
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }
  if (!UUID_RE.test(studentId)) {
    return json({ error: 'studentId inválido' }, 400)
  }

  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: perf, error: perfError } = await asCaller.rpc('get_student_progress_admin', {
    _student_id: studentId,
  })
  if (perfError || !perf) {
    return json({ error: 'Não foi possível carregar o progresso do aluno' }, 400)
  }

  // deno-lint-ignore no-explicit-any
  const p = perf as any
  const recipient = sendToMe ? caller.email : p?.student?.email
  if (!recipient) {
    return json({ error: 'Destinatário sem e-mail cadastrado' }, 400)
  }

  const totalXp = (p.student?.xp ?? 0) + (p.student?.ai_xp ?? 0)
  const bestByAi: Record<string, number | null | undefined> = {
    falae: p.scores?.scripted ?? p.scores?.unscripted,
    escutae: p.scores?.listening,
    escreveae: p.scores?.writing,
  }

  const templateData = {
    studentName: p.student?.display_name ?? null,
    dateLabel: fmtDate(new Date().toISOString()),
    level: p.student?.level ?? null,
    planTier: p.student?.plan_tier ?? null,
    totalXp,
    summary: [
      { label: 'Curso', value: `${p.videos?.percent ?? 0}% (${p.videos?.done ?? 0}/${p.videos?.total ?? 0} vídeos)` },
      { label: 'Média dos quizzes', value: fmtGrade(p.quiz_avg) },
      {
        label: 'Atividades de IA',
        // deno-lint-ignore no-explicit-any
        value: `${Object.values(p.ais ?? {}).reduce((s: number, a: any) => s + (a?.events ?? 0), 0)} sessões`,
      },
      { label: 'Última atividade', value: fmtDate(p.student?.last_activity) },
    ],
    // deno-lint-ignore no-explicit-any
    courses: (p.progress ?? []).map((c: any) => ({
      label: c.code,
      value: `${c.videos_done}/${c.videos_total} · ${c.percent}%`,
    })),
    ais: Object.keys(AI_LABELS)
      .filter((k) => k !== 'books')
      .map((k) => {
        const stat = p.ais?.[k] ?? { xp: 0, events: 0 }
        const best = bestByAi[k]
        const suffix =
          best !== null && best !== undefined ? ` · melhor nota ${fmtGrade(best)}` : ''
        return { label: AI_LABELS[k], value: `${stat.xp} XP · ${stat.events} ativ.${suffix}` }
      }),
    bst: [
      { label: 'IA Falaê BST', value: `${p.bst?.falae_xp ?? 0} XP · ${p.bst?.falae_events ?? 0} ativ.` },
      { label: 'IA Leiaê BST', value: `${p.bst?.leiae_xp ?? 0} XP · ${p.bst?.leiae_events ?? 0} leituras` },
      { label: 'Quizzes BST', value: `${fmtGrade(p.bst?.quiz_avg)} (${p.bst?.quiz_attempts ?? 0} tentativas)` },
      { label: 'Produtos BST liberados', value: String(p.bst?.products ?? 0) },
    ],
    books: [
      { label: 'XP de leitura', value: `${p.books?.xp ?? 0} XP` },
      {
        label: 'Capítulos lidos',
        value: `${p.books?.chapters_read ?? 0} (${p.books?.chapters_done ?? 0} concluídos)`,
      },
      { label: 'Média dos quizzes', value: fmtGrade(p.books?.quiz_avg) },
    ],
    // deno-lint-ignore no-explicit-any
    recent: (p.recent ?? []).slice(0, 10).map((r: any) => ({
      label: `${AI_LABELS[r.type] ?? r.type} · ${fmtDate(r.at)}`,
      value: `+${r.points ?? 0} XP`,
    })),
  }

  try {
    const result = await sendTemplateEmail(TEMPLATE_NAME, recipient, {
      templateData,
      idempotencyKey: `${TEMPLATE_NAME}-${studentId}-${recipient}-${Date.now()}`,
    })
    if (!result.sent) {
      return json({ success: false, reason: 'recipient_suppressed', recipient })
    }
    return json({ success: true, recipient })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to send student progress email', { message })
    return json({ error: 'Falha ao enviar o e-mail' }, 500)
  }
})
