import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Search, ArrowLeft, PlayCircle, Trophy, GraduationCap, Clock } from "lucide-react";
import BackToDashboardButton from "@/components/BackToDashboardButton";

interface StudentRow {
  student_id: string;
  display_name: string | null;
  email: string | null;
  level: string | null;
  plan_tier: string | null;
  xp: number | null;
  last_activity: string | null;
}

interface CoursePerf {
  course_id: string;
  title: string;
  level: string | null;
  videos_done: number;
  videos_total: number;
  videos_percent: number;
  best_quiz: number | null;
}

interface Performance {
  student: {
    user_id: string;
    display_name: string | null;
    level: string | null;
    xp: number | null;
    plan_tier: string | null;
    started_at: string | null;
    last_activity: string | null;
  };
  videos: { done: number; total: number; percent: number };
  best_score: { score: number; quiz_title: string | null; level: string | null; created_at: string } | null;
  score: number | null;
  score_parts: Record<string, number | null>;
  courses: CoursePerf[];
  recent: { type: string; title: string | null; at: string; score: number | null }[];
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default function TeacherArea() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAnyStudent, setHasAnyStudent] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // debounce da busca
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_my_students", {
      _search: search.trim() || null,
    });
    if (error) {
      setStudents([]);
    } else {
      const rows = (data as StudentRow[]) ?? [];
      setStudents(rows);
      if (!search.trim()) setHasAnyStudent(rows.length > 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(debounced);
  }, [debounced, load]);

  const openPerformance = async (s: StudentRow) => {
    setSelected(s);
    setPerf(null);
    setPerfLoading(true);
    const { data } = await (supabase as any).rpc("get_student_performance", { _student_id: s.student_id });
    setPerf((data as Performance) ?? null);
    setPerfLoading(false);
  };

  const scoreLabel = useMemo(() => {
    if (!perf || perf.score === null || perf.score === undefined) return "—";
    return `${Number(perf.score).toFixed(1)}%`;
  }, [perf]);

  if (selected) {
    return (
      <div className="space-y-6 max-w-5xl page-transition">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setSelected(null);
            setPerf(null);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar para meus alunos
        </Button>

        <div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground tracking-tight">
            Performance do aluno
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selected.display_name || selected.email}
          </p>
        </div>

        {perfLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando performance" />
          </div>
        ) : !perf ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Não foi possível carregar a performance deste aluno.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {perf.student.level && <Badge variant="secondary">Nível {perf.student.level}</Badge>}
              <Badge variant="outline">Início: {fmtDate(perf.student.started_at)}</Badge>
              <Badge variant="outline">XP: {perf.student.xp ?? 0}</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <PlayCircle className="h-3.5 w-3.5" /> Vídeos assistidos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-display font-extrabold tabular-nums">
                    {perf.videos.done}
                    <span className="text-sm font-medium text-muted-foreground"> / {perf.videos.total}</span>
                  </p>
                  <Progress value={perf.videos.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground tabular-nums">{perf.videos.percent}% concluído</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" /> Melhor pontuação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-display font-extrabold tabular-nums">
                    {perf.best_score ? `${perf.best_score.score}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {perf.best_score
                      ? `${perf.best_score.quiz_title ?? "Quiz"}${perf.best_score.level ? ` — ${perf.best_score.level}` : ""} · ${fmtDate(perf.best_score.created_at)}`
                      : "Nenhuma atividade avaliativa registrada"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" /> Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {/* Score = mesma nota média oficial exibida ao aluno (quizzes + IAs). */}
                  <p className="text-2xl font-display font-extrabold tabular-nums">{scoreLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Quizzes: {perf.score_parts.quiz_avg?.toFixed?.(1) ?? "—"} · Falaê:{" "}
                    {perf.score_parts.best_scripted?.toFixed?.(1) ?? "—"}/
                    {perf.score_parts.best_unscripted?.toFixed?.(1) ?? "—"} · Escutaê:{" "}
                    {perf.score_parts.best_listening?.toFixed?.(1) ?? "—"} · Escreveaê:{" "}
                    {perf.score_parts.best_writing?.toFixed?.(1) ?? "—"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Último acesso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-display font-extrabold">{fmtDate(perf.student.last_activity)}</p>
                </CardContent>
              </Card>
            </div>

            {perf.courses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desempenho por curso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {perf.courses.map((c) => (
                    <div key={c.course_id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{c.title}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {c.videos_done}/{c.videos_total} vídeos · {c.videos_percent}%
                          {c.best_quiz !== null ? ` · melhor quiz ${c.best_quiz}%` : ""}
                        </span>
                      </div>
                      <Progress value={c.videos_percent} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {perf.recent.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Atividades recentes</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {perf.recent.slice(0, 12).map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-6 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{r.title ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.type === "quiz" ? "Quiz realizado" : "Vídeo concluído"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {r.score !== null && (
                          <p className="text-sm font-semibold tabular-nums">{r.score}%</p>
                        )}
                        <p className="text-xs text-muted-foreground">{fmtDate(r.at)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl page-transition">
      <BackToDashboardButton className="-ml-2" />

      <div>
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground tracking-tight">
          Área do Professor
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Acompanhe o progresso dos seus alunos.
        </p>
      </div>

      <div className="max-w-md space-y-1.5">
        <Label htmlFor="teacher-search" className="text-xs uppercase font-semibold text-muted-foreground">
          Buscar aluno
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="teacher-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome do aluno..."
            className="pl-9 h-11"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Meus alunos</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando alunos" />
          </div>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-1">
              {hasAnyStudent === false && !query.trim() ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Você ainda não possui alunos vinculados.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Os vínculos são gerenciados pelo administrador do Falaê Brasil.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum aluno encontrado entre os seus alunos.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {students.map((s) => (
              <Card key={s.student_id} className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {s.display_name || s.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.level ? `Nível ${s.level}` : "Nível —"}
                      {s.last_activity ? ` · último acesso ${fmtDate(s.last_activity)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" className="w-full min-h-[40px]" onClick={() => openPerformance(s)}>
                    Ver performance
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
