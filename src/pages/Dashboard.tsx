import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, BookOpen, Trophy, GraduationCap, Info, Brain, Mic, Headphones, MessageSquare, BookText, GraduationCap as GradIcon, Presentation, Music, BookMarked, Library, Crown, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OnboardingTutorialModal from "@/components/OnboardingTutorialModal";
import { useGPA } from "@/hooks/useGPA";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchAiXpBreakdown, AI_LABELS, type AiSource } from "@/lib/aiXp";
import { useRoles } from "@/hooks/useRoles";

interface RankingStudent {
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: string | null;
  total_xp: number | null;
  rank_position: number | null;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// "Adenilson Dutra da Silva" -> "A. D. S" | "Ronaldo" -> "R." | 4+ nomes -> 3 primeiras iniciais
function abbreviateName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Aluno";
  return parts
    .slice(0, 3)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const { isTeacher } = useRoles();
  const [completedCount, setCompletedCount] = useState(0);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [ranking, setRanking] = useState<RankingStudent[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [aiXp, setAiXp] = useState<Record<AiSource, number> & { total: number }>({
    memorizae: 0, falae: 0, escutae: 0, escreveae: 0, leiae: 0, musiclab: 0, books: 0, total: 0,
  });
  const gpaData = useGPA(user?.id);

  useEffect(() => {
    if (!user) return;
    fetchAiXpBreakdown(user.id).then(setAiXp);
  }, [user?.id]);

  const aiButtons: { source: AiSource; icon: any; path: string }[] = [
    { source: "memorizae", icon: Brain, path: "/memorizae" },
    { source: "falae", icon: Mic, path: "/voice-lab" },
    { source: "escutae", icon: Headphones, path: "/listening-lab" },
    { source: "escreveae", icon: MessageSquare, path: "/writing-lab" },
    { source: "leiae", icon: BookText, path: "/leiae" },
  ];

  const libraryButtons: { labelKey: string; icon: any; path: string; xpKey?: keyof typeof aiXp }[] = [
    { labelKey: "nav.library.bst", icon: Library, path: "/library" },
    { labelKey: "nav.library.books", icon: BookMarked, path: "/books", xpKey: "books" },
  ];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: vprog } = await supabase.from("user_video_progress").select("video_id").eq("user_id", user.id);
      setCompletedCount((vprog || []).length);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadRanking = async () => {
      setRankingLoading(true);
      const { data, error } = await supabase
        .from("xp_ranking")
        .select("user_id, display_name, avatar_url, level, total_xp, rank_position")
        .order("rank_position", { ascending: true })
        .limit(5);

      if (error) {
        console.warn("Não foi possível carregar o ranking de XP", error.message);
        setRanking([]);
      } else {
        setRanking(data ?? []);
      }
      setRankingLoading(false);
    };

    loadRanking();
  }, [user]);

  const stats = [
    {
      label: t("dashboard.xp"),
      value: String((profile?.xp ?? 0) + (aiXp.total ?? 0)),
      icon: Zap,
      gradient: "bg-gradient-xp",
      iconColor: "text-xp-foreground",
      tooltip: "XP total = aulas assistidas + quizzes + práticas nas IAs (Memorizaê, Falaê, Escutaê, Escreveaê e Leiaê).",
    },
    { label: t("dashboard.level"), value: profile?.level ?? "A1", icon: Trophy, gradient: "bg-gradient-accent", iconColor: "text-accent-foreground" },
    {
      label: t("dashboard.gpa"),
      value: gpaData.gpa !== null ? `${gpaData.letter} · ${gpaData.gpa.toFixed(1)}` : "—",
      icon: GraduationCap,
      gradient: "bg-gradient-to-br from-primary to-primary/70",
      iconColor: "text-primary-foreground",
      tooltip: gpaData.gpa !== null
        ? `Quizzes: ${gpaData.quizAvg?.toFixed(1) ?? "—"} | Scripted: ${gpaData.bestScripted?.toFixed(1) ?? "—"} | Unscripted: ${gpaData.bestUnscripted?.toFixed(1) ?? "—"} | Escutaê: ${gpaData.bestListening?.toFixed(1) ?? "—"} | Escreveaê: ${gpaData.bestWriting?.toFixed(1) ?? "—"}${gpaData.gpaPoints !== null ? ` · GPA ${gpaData.gpaPoints.toFixed(1)}` : ""}`
        : "Faça quizzes e práticas no IA Falaê, Escutaê ou Escreveaê para gerar sua nota.",
    },
    { label: t("dashboard.completed"), value: String(completedCount), icon: BookOpen, gradient: "bg-gradient-to-br from-success to-success/70", iconColor: "text-success-foreground" },
  ];

  return (
    <div className="space-y-8 max-w-6xl page-transition">
      <OnboardingTutorialModal />
      {isTeacher && (
        <div className="animate-fade-up">
          <Button
            onClick={() => navigate("/professor/alunos")}
            className="w-full sm:w-auto min-h-[44px] font-semibold"
          >
            <Presentation className="h-4 w-4 mr-2" />
            Meus Alunos
          </Button>
        </div>
      )}
      <div className="animate-fade-up">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground tracking-tight">
          {t("dashboard.title")}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          {t("dashboard.welcome")}
        </p>
      </div>

      {/* AI quick-access + Courses */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 animate-fade-up">
        <button
          onClick={() => navigate("/courses")}
          className="group flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-border/60 bg-card p-2 sm:p-3 text-center hover:border-primary hover:bg-primary/5 transition"
        >
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
            <GradIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <span className="text-[11px] sm:text-sm font-semibold text-foreground leading-tight">Cursos FB!</span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">Acessar</span>
        </button>

        <Dialog open={practiceOpen} onOpenChange={setPracticeOpen}>
          <DialogTrigger asChild>
            <button className="group flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-border/60 bg-card p-2 sm:p-3 text-center hover:border-primary hover:bg-primary/5 transition">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
                <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="text-[11px] sm:text-sm font-semibold text-foreground leading-tight">Praticaê (IAs)</span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">Treinar</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-5 pb-3">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-primary" />
                Praticaê (IAs)
              </DialogTitle>
            </DialogHeader>
            <div className="p-5 pt-0 space-y-2">
              {aiButtons.map(({ source, icon: Icon, path }) => (
                <button
                  key={source}
                  onClick={() => {
                    setPracticeOpen(false);
                    navigate(path);
                  }}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary hover:bg-primary/5 transition"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{AI_LABELS[source]}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{aiXp[source]} XP</p>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
          <DialogTrigger asChild>
            <button className="group flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-border/60 bg-card p-2 sm:p-3 text-center hover:border-primary hover:bg-primary/5 transition">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
                <Library className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="text-[11px] sm:text-sm font-semibold text-foreground leading-tight">Bibliotecaê</span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">Acessar</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-5 pb-3">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Library className="h-5 w-5 text-primary" />
                Bibliotecaê
              </DialogTitle>
            </DialogHeader>
            <div className="p-5 pt-0 space-y-2">
              {libraryButtons.map(({ labelKey, icon: Icon, path, xpKey }) => (
                <button
                  key={labelKey}
                  onClick={() => {
                    setLibraryOpen(false);
                    navigate(path);
                  }}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary hover:bg-primary/5 transition"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t(labelKey)}</p>
                    {xpKey && <p className="text-[11px] text-muted-foreground tabular-nums">{aiXp[xpKey]} XP</p>}
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <button
          onClick={() => navigate("/music-lab")}
          className="group flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-border/60 bg-card p-2 sm:p-3 text-center hover:border-primary hover:bg-primary/5 transition"
        >
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
            <Music className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <span className="text-[11px] sm:text-sm font-semibold text-foreground leading-tight">Cantaê</span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">{aiXp.musiclab} XP</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat: any, i) => {
          const isGPA = stat.label === "Sua Nota Média";
          const cardContent = (
            <CardContent className="flex items-center gap-4 p-5 relative">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.gradient} shadow-soft-md hover-bounce`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-display font-extrabold text-foreground tabular-nums truncate">{stat.value}</p>
                  {isGPA && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Ver detalhes do desempenho mensal"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-primary" />
                            Meu Desempenho Mensal
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-border/50">
                            <span className="text-sm font-medium">Média dos Quizzes</span>
                            <span className="font-bold text-primary">{gpaData.quizAvg?.toFixed(1) ?? "—"}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-border/50">
                            <span className="text-sm font-medium">Maior nota de voz com script</span>
                            <span className="font-bold text-primary">{gpaData.bestScripted?.toFixed(1) ?? "—"}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-border/50">
                            <span className="text-sm font-medium">Maior nota de voz sem script</span>
                            <span className="font-bold text-primary">{gpaData.bestUnscripted?.toFixed(1) ?? "—"}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-border/50">
                            <span className="text-sm font-medium">Maior nota da IA Escutaê</span>
                            <span className="font-bold text-primary">{gpaData.bestListening?.toFixed(1) ?? "—"}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-border/50">
                            <span className="text-sm font-medium">Maior nota da IA Escreveaê</span>
                            <span className="font-bold text-primary">{gpaData.bestWriting?.toFixed(1) ?? "—"}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center">
                            A média é calculada a partir destes cinco pilares.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              </div>
            </CardContent>
          );

          return (
            <Card
              key={stat.label}
              className="animate-fade-up hover-lift card-shine cursor-default border-border/50 overflow-hidden relative"
              style={{ "--delay": `${80 * (i + 1)}ms` } as React.CSSProperties}
            >
              {isGPA ? (
                cardContent
              ) : (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {cardContent}
                    </TooltipTrigger>
                    {stat.tooltip && (
                      <TooltipContent side="bottom" className="max-w-xs text-xs">
                        {stat.tooltip}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
            </Card>
          );
        })}
      </div>

      <section className="animate-fade-up" aria-labelledby="xp-ranking-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 id="xp-ranking-title" className="text-xl font-display font-bold text-foreground">
                Ranking de XP
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Os cinco alunos que estão no topo.</p>
          </div>
          <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Top 5
          </span>
        </div>

        <Card className="overflow-hidden border-border/50 bg-card">
          <CardContent className="p-4 sm:p-6">
            {rankingLoading ? (
              <div className="grid min-h-52 grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Carregando ranking">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex flex-col items-center gap-3 animate-pulse">
                    <div className="h-14 w-14 rounded-full bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                    <div className={`w-full rounded-t-lg bg-muted ${item === 2 ? "h-24" : "h-16"}`} />
                  </div>
                ))}
              </div>
            ) : ranking.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center text-center">
                <Trophy className="mb-3 h-9 w-9 text-muted-foreground" aria-hidden="true" />
                <p className="font-semibold text-foreground">O pódio está esperando.</p>
                <p className="mt-1 text-sm text-muted-foreground">Complete atividades para conquistar XP.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
                  {[ranking[1], ranking[0], ranking[2]].map((student, podiumIndex) => {
                    if (!student) return <div key={`empty-${podiumIndex}`} />;
                    const place = podiumIndex === 0 ? 2 : podiumIndex === 1 ? 1 : 3;
                    const isCurrentUser = student.user_id === user?.id;
                    const name = student.display_name?.trim() || "Aluno";
                    const podiumHeight = place === 1 ? "min-h-32 sm:min-h-36" : place === 2 ? "min-h-24 sm:min-h-28" : "min-h-20 sm:min-h-24";
                    const placeStyle = place === 1
                      ? "border-xp/50 bg-xp/10 text-xp"
                      : place === 2
                        ? "border-muted-foreground/35 bg-muted/60 text-foreground"
                        : "border-warning/40 bg-warning/10 text-warning";

                    return (
                      <div key={student.user_id ?? place} className="flex min-w-0 flex-col items-center text-center">
                        <div className="relative mb-2">
                          {place === 1 && <Crown className="absolute -top-6 left-1/2 h-5 w-5 -translate-x-1/2 text-xp" aria-hidden="true" />}
                          <Avatar className={`h-12 w-12 border-2 sm:h-16 sm:w-16 ${isCurrentUser ? "border-primary ring-4 ring-primary/15" : "border-border"}`}>
                            <AvatarImage src={student.avatar_url ?? undefined} alt="" />
                            <AvatarFallback className="bg-muted text-sm font-bold text-foreground">{getInitials(name)}</AvatarFallback>
                          </Avatar>
                          <span className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-xs font-extrabold ${placeStyle}`}>
                            {place}
                          </span>
                        </div>
                        <p className="w-full truncate text-xs font-semibold text-foreground sm:text-sm" title={name}>
                          {isCurrentUser ? "Você" : name}
                        </p>
                        <p className="mb-3 text-[11px] font-bold tabular-nums text-muted-foreground sm:text-xs">
                          {(student.total_xp ?? 0).toLocaleString("pt-BR")} XP
                        </p>
                        <div className={`flex w-full flex-col items-center justify-center rounded-t-lg border border-b-0 ${podiumHeight} ${placeStyle}`}>
                          {place === 1 ? <Crown className="h-6 w-6" aria-hidden="true" /> : <Medal className="h-5 w-5" aria-hidden="true" />}
                          <span className="mt-1 text-xs font-extrabold uppercase">{place}º lugar</span>
                          <span className="mt-1 text-[10px] font-semibold opacity-75">Nível {student.level ?? "A1"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {ranking.length > 3 && (
                  <div className="mt-4 grid gap-2 border-t border-border/50 pt-4 sm:grid-cols-2">
                    {ranking.slice(3, 5).map((student, index) => {
                      const place = index + 4;
                      const isCurrentUser = student.user_id === user?.id;
                      const name = student.display_name?.trim() || "Aluno";
                      return (
                        <div
                          key={student.user_id ?? place}
                          className={`flex items-center gap-3 rounded-lg border p-3 ${isCurrentUser ? "border-primary/50 bg-primary/5" : "border-border/50 bg-muted/20"}`}
                        >
                          <span className="w-7 text-center text-lg font-extrabold tabular-nums text-muted-foreground">{place}º</span>
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={student.avatar_url ?? undefined} alt="" />
                            <AvatarFallback className="bg-muted text-xs font-bold text-foreground">{getInitials(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{isCurrentUser ? "Você" : name}</p>
                            <p className="text-xs text-muted-foreground">Nível {student.level ?? "A1"}</p>
                          </div>
                          <span className="shrink-0 text-sm font-extrabold tabular-nums text-primary">
                            {(student.total_xp ?? 0).toLocaleString("pt-BR")} XP
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
