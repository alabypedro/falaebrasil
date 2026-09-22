import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Loader2,
  Brain,
  Headphones,
  Mic,
  BookOpenText,
  PenLine,
  Music,
  GraduationCap,
  Trophy,
  Zap,
  BookText,
  Package,
  Clock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type AiStat = { xp: number; events: number };

interface Perf {
  student: {
    display_name: string | null;
    email: string | null;
    level: string | null;
    plan_tier: string | null;
    xp: number | null;
    ai_xp: number | null;
    started_at: string | null;
    last_activity: string | null;
  };
  videos: { done: number; total: number; percent: number };
  quiz_avg: number | null;
  scores: {
    scripted: number | null;
    unscripted: number | null;
    listening: number | null;
    writing: number | null;
  };
  progress: { code: string; percent: number; videos_done: number; videos_total: number }[];
  ais: Record<string, AiStat>;
  bst: {
    falae_xp: number;
    falae_events: number;
    leiae_xp: number;
    leiae_events: number;
    quiz_attempts: number;
    quiz_avg: number | null;
    products: number;
  };
  books: {
    xp: number;
    events: number;
    chapters_read: number;
    chapters_done: number;
    quiz_avg: number | null;
  };
  recent: { type: string; title: string | null; at: string; points: number | null }[];
  activity_history: { date: string; xp: number; events: number }[];
}

const AI_LIST = [
  { key: "memorizae", label: "IA Memorizaê", icon: Brain },
  { key: "escutae", label: "IA Escutaê", icon: Headphones },
  { key: "falae", label: "IA Falaê", icon: Mic },
  { key: "leiae", label: "IA Leiaê", icon: BookOpenText },
  { key: "escreveae", label: "IA Escreveaê", icon: PenLine },
  { key: "musiclab", label: "Cantaê", icon: Music },
] as const;

const AI_LABELS: Record<string, string> = {
  memorizae: "IA Memorizaê",
  escutae: "IA Escutaê",
  falae: "IA Falaê",
  leiae: "IA Leiaê",
  escreveae: "IA Escreveaê",
  musiclab: "Cantaê",
  books: "Estórias Curtas",
};

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fmtGrade = (v?: number | null) =>
  v === null || v === undefined ? "—" : `${Number(v).toFixed(0)}%`;

const chartConfig = {
  xp: { label: "XP", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

function XpEvolutionChart({
  title,
  days,
  history,
}: {
  title: string;
  days: number;
  history: Perf["activity_history"];
}) {
  const data = history.slice(-days).map((item) => ({
    ...item,
    label: new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));
  const totalXp = data.reduce((sum, item) => sum + item.xp, 0);
  const activeDays = data.filter((item) => item.events > 0).length;
  const tickInterval = days === 7 ? 0 : days === 30 ? 5 : 14;

  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-[11px] text-muted-foreground">XP por dia</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-primary">{totalXp} XP</p>
          <p className="text-[10px] text-muted-foreground">{activeDays} dias ativos</p>
        </div>
      </div>
      <ChartContainer config={chartConfig} className="h-48 w-full aspect-auto">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
            minTickGap={12}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                formatter={(value, name, item) => (
                  <div className="flex min-w-28 items-center justify-between gap-4">
                    <span className="text-muted-foreground">{name === "xp" ? "XP" : name}</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {Number(value).toLocaleString("pt-BR")} XP
                    </span>
                    {item.payload.events > 0 && (
                      <span className="text-muted-foreground">{item.payload.events} ativ.</span>
                    )}
                  </div>
                )}
              />
            }
          />
          <Line
            dataKey="xp"
            type="monotone"
            stroke="var(--color-xp)"
            strokeWidth={2}
            dot={days === 7 ? { r: 3, fill: "var(--color-xp)" } : false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
      {helper && <p className="text-[11px] text-muted-foreground leading-tight">{helper}</p>}
    </div>
  );
}

export default function StudentProgressDialog({
  open,
  onOpenChange,
  studentId,
  fallbackName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  fallbackName?: string | null;
}) {
  const [perf, setPerf] = useState<Perf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);

  const sendReport = async (recipient: "student" | "me") => {
    setSending(true);
    const { data, error: err } = await supabase.functions.invoke("send-student-progress", {
      body: { studentId, recipient },
    });
    setSending(false);
    if (err) {
      toast.error("Não foi possível enviar o relatório por e-mail.");
      return;
    }
    if ((data as any)?.success) {
      toast.success(`Relatório enviado para ${(data as any).recipient}.`);
    } else if ((data as any)?.reason === "recipient_suppressed") {
      toast.error("Este e-mail está bloqueado para envios.");
    } else {
      toast.error((data as any)?.error ?? "Não foi possível enviar o relatório.");
    }
  };


  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setPerf(null);
    (async () => {
      const { data, error: err } = await (supabase as any).rpc("get_student_progress_admin", {
        _student_id: studentId,
      });
      if (cancelled) return;
      if (err || !data) setError(true);
      else setPerf(data as Perf);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  const aiMax = perf
    ? Math.max(1, ...AI_LIST.map((a) => perf.ais?.[a.key]?.xp ?? 0))
    : 1;
  const activityHistory = useMemo(() => perf?.activity_history ?? [], [perf?.activity_history]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Progresso de {perf?.student.display_name || fallbackName || "aluno"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error || !perf ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Não foi possível carregar o progresso deste aluno.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {perf.student.email && <Badge variant="outline">{perf.student.email}</Badge>}
              <Badge variant="secondary">Nível {perf.student.level || "—"}</Badge>
              {perf.student.plan_tier && (
                <Badge variant="secondary" className="uppercase">{perf.student.plan_tier}</Badge>
              )}
              <Badge variant="outline">Início: {fmtDate(perf.student.started_at)}</Badge>
              <Badge variant="outline">Última atividade: {fmtDate(perf.student.last_activity)}</Badge>
            </div>

            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={Zap}
                label="XP total"
                value={(perf.student.xp ?? 0) + (perf.student.ai_xp ?? 0)}
                helper={`${perf.student.ai_xp ?? 0} XP das IAs`}
              />
              <Metric
                icon={GraduationCap}
                label="Curso"
                value={`${perf.videos.percent}%`}
                helper={`${perf.videos.done}/${perf.videos.total} vídeos`}
              />
              <Metric icon={Trophy} label="Média dos quizzes" value={fmtGrade(perf.quiz_avg)} />
              <Metric
                icon={Clock}
                label="Atividades de IA"
                value={Object.values(perf.ais || {}).reduce((s, a) => s + (a?.events ?? 0), 0)}
                helper="sessões com XP"
              />
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Progresso por curso</h3>
                {perf.progress.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum curso publicado com vídeos.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {perf.progress.map((p) => (
                      <div key={p.code} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{p.code}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {p.videos_done}/{p.videos_total} · {p.percent}%
                          </span>
                        </div>
                        <Progress value={p.percent} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">As 5 IAs + Cantaê</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {AI_LIST.map(({ key, label, icon: Icon }) => {
                    const stat = perf.ais?.[key] ?? { xp: 0, events: 0 };
                    const pct = Math.round((stat.xp / aiMax) * 100);
                    const best =
                      key === "falae"
                        ? perf.scores.scripted ?? perf.scores.unscripted
                        : key === "escutae"
                          ? perf.scores.listening
                          : key === "escreveae"
                            ? perf.scores.writing
                            : null;
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Icon className="h-4 w-4 text-primary" /> {label}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {stat.xp} XP · {stat.events} ativ.
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[11px] text-muted-foreground">
                          {best !== null && best !== undefined
                            ? `Melhor nota: ${fmtGrade(best)}`
                            : stat.events > 0
                              ? "Em prática"
                              : "Sem atividade ainda"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" /> IAs do BST
                  </h3>
                  <div className="grid gap-2 grid-cols-2">
                    <Metric icon={Mic} label="IA Falaê BST" value={`${perf.bst.falae_xp} XP`} helper={`${perf.bst.falae_events} atividades`} />
                    <Metric icon={BookOpenText} label="IA Leiaê BST" value={`${perf.bst.leiae_xp} XP`} helper={`${perf.bst.leiae_events} leituras`} />
                    <Metric icon={Trophy} label="Quizzes BST" value={fmtGrade(perf.bst.quiz_avg)} helper={`${perf.bst.quiz_attempts} tentativas`} />
                    <Metric icon={Package} label="Produtos BST" value={perf.bst.products} helper="liberados" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BookText className="h-4 w-4 text-primary" /> Estórias Curtas
                  </h3>
                  <div className="grid gap-2 grid-cols-2">
                    <Metric icon={Zap} label="XP de leitura" value={perf.books.xp} helper={`${perf.books.events} quizzes com XP`} />
                    <Metric icon={BookText} label="Capítulos lidos" value={perf.books.chapters_read} helper={`${perf.books.chapters_done} concluídos`} />
                    <Metric icon={Trophy} label="Média dos quizzes" value={fmtGrade(perf.books.quiz_avg)} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Atividades recentes</h3>
                {perf.recent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {perf.recent.map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2 text-xs">
                        <span className="min-w-0 truncate text-foreground">
                          <Badge variant="secondary" className="mr-2 text-[10px]">
                            {AI_LABELS[r.type] ?? r.type}
                          </Badge>
                          {(r.title || "").replace(/^[a-z-]+:/, "")}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          +{r.points ?? 0} XP · {fmtDate(r.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Evolução de XP por atividade</h3>
                  <p className="text-xs text-muted-foreground">Comparativo diário das atividades recentes ao longo do tempo.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <XpEvolutionChart title="Últimos 7 dias" days={7} history={activityHistory} />
                  <XpEvolutionChart title="Últimos 30 dias" days={30} history={activityHistory} />
                  <XpEvolutionChart title="Últimos 90 dias" days={90} history={activityHistory} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
