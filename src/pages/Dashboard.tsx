import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, BookOpen, Trophy, GraduationCap, Info, Brain, Mic, Headphones, MessageSquare, BookText, GraduationCap as GradIcon, Presentation, Music, BookMarked, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const { isTeacher } = useRoles();
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
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
      const { data: courses } = await supabase.from("courses").select("id, title, level, required_tier").eq("published", true).order("display_order");
      const { data: modules } = await supabase.from("modules").select("id, course_id");
      const { data: lessons } = await supabase.from("lessons").select("id, module_id");
      const { data: videos } = await supabase.from("lesson_videos").select("id, lesson_id");
      const { data: vprog } = await supabase.from("user_video_progress").select("video_id").eq("user_id", user.id);

      const completedVideoIds = new Set((vprog || []).map((p) => p.video_id));
      setCompletedCount(completedVideoIds.size);

      const modCourse: Record<string, string> = {};
      (modules || []).forEach((m) => { modCourse[m.id] = m.course_id; });
      const lessonCourse: Record<string, string> = {};
      (lessons || []).forEach((l) => { const cid = modCourse[l.module_id]; if (cid) lessonCourse[l.id] = cid; });

      const courseVideos: Record<string, string[]> = {};
      (videos || []).forEach((v) => {
        const cid = lessonCourse[v.lesson_id];
        if (cid) { if (!courseVideos[cid]) courseVideos[cid] = []; courseVideos[cid].push(v.id); }
      });

      const userTier = (profile?.plan_tier ?? "open").toLowerCase();
      const allowedTiers =
        userTier === "teens" ? ["teens"]
        : userTier === "kids" ? ["kids"]
        : ["open", "pro", "vip", "teens", "kids"];

      const result = (courses || [])
        .filter((c: any) => allowedTiers.includes((c.required_tier ?? "open").toLowerCase()))
        .map((c: any) => {
          const ids = courseVideos[c.id] || [];
          const done = ids.filter((id) => completedVideoIds.has(id)).length;
          const code = (c.level || extractCode(c.title) || "").toUpperCase();
          return {
            name: code || c.title,
            code,
            progress: ids.length > 0 ? Math.round((done / ids.length) * 100) : 0,
          };
        })
        .filter((r) => desiredOrder.includes(r.code))
        .sort((a, b) => desiredOrder.indexOf(a.code) - desiredOrder.indexOf(b.code));
      setCourseProgress(result);
    };
    load();
  }, [user, profile?.plan_tier]);

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

      {courseProgress.length > 0 && (
        <Card className="animate-fade-up border-border/50" style={{ "--delay": "400ms" } as React.CSSProperties}>
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gradient-accent animate-pulse" />
              {t("dashboard.progress")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {courseProgress.map((track, i) => (
              <div
                key={track.name}
                className="space-y-2 animate-fade-up"
                style={{ "--delay": `${450 + i * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{track.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums font-bold">{track.progress}%</span>
                </div>
                <Progress value={track.progress} className="h-2 [&>div]:bg-gradient-accent" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
