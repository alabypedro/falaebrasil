import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, BookOpen, Trophy, ArrowRight, GraduationCap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OnboardingTutorialModal from "@/components/OnboardingTutorialModal";
import { useMonthlyGPA } from "@/hooks/useMonthlyGPA";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface CourseProgress {
  name: string;
  progress: number;
}

const desiredOrder = ["A1", "A2", "B1", "B2", "T1", "T2", "T3", "T4", "K1", "K2", "K3", "K4"];

function extractCode(title: string): string | null {
  const m = title.match(/\b([ATK][1-4]|A1|A2|B1|B2)\b/i);
  if (m) return m[1].toUpperCase();
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const gpaData = useMonthlyGPA(user?.id);

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
        : ["open", "pro", "vip"];

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
    { label: "XP Total", value: String(profile?.xp ?? 0), icon: Zap, gradient: "bg-gradient-xp", iconColor: "text-xp-foreground" },
    { label: "Nível de Fluência", value: profile?.level ?? "A1", icon: Trophy, gradient: "bg-gradient-accent", iconColor: "text-accent-foreground" },
    {
      label: "GPA do Mês",
      value: gpaData.gpa !== null ? `${gpaData.letter} · ${gpaData.gpa.toFixed(1)}` : "—",
      icon: GraduationCap,
      gradient: "bg-gradient-to-br from-primary to-primary/70",
      iconColor: "text-primary-foreground",
      tooltip: gpaData.gpa !== null
        ? `Quizzes: ${gpaData.quizAvg?.toFixed(1) ?? "—"} | Scripted: ${gpaData.bestScripted?.toFixed(1) ?? "—"} | Unscripted: ${gpaData.bestUnscripted?.toFixed(1) ?? "—"}${gpaData.gpaPoints !== null ? ` · GPA ${gpaData.gpaPoints.toFixed(1)}` : ""}`
        : "Faça quizzes e práticas no IA Falaê para gerar sua nota.",
    },
    { label: "Aulas Concluídas", value: String(completedCount), icon: BookOpen, gradient: "bg-gradient-to-br from-success to-success/70", iconColor: "text-success-foreground" },
    { label: "Streak", value: `${profile?.streak_days ?? 0} dias`, icon: Flame, gradient: "bg-gradient-to-br from-destructive to-destructive/70", iconColor: "text-destructive-foreground" },
  ];

  return (
    <div className="space-y-8 max-w-6xl page-transition">
      <OnboardingTutorialModal />
      <div className="animate-fade-up">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Bem-vindo de volta! Continue sua jornada de aprendizado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat: any, i) => {
          const isGPA = stat.label === "GPA do Mês";
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
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-primary" />
                            Meu Desempenho
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
                          <p className="text-[10px] text-muted-foreground text-center">
                            A média GPA é calculada a partir destes três pilares.
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
              Progresso por Curso
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

      <Card
        className="relative overflow-hidden bg-gradient-hero text-white border-0 animate-fade-up hover-lift-lg shadow-elegant"
        style={{ "--delay": "550ms" } as React.CSSProperties}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl animate-blob" style={{ animationDelay: "3s" }} />

        <CardContent className="relative flex flex-col items-center gap-5 p-8 md:p-10 text-center sm:flex-row sm:text-left">
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-semibold border border-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-glow animate-pulse" />
              Pratique agora
            </div>
            <h3 className="text-xl md:text-2xl font-display font-extrabold leading-tight">
              Pratique sua pronúncia agora!
            </h3>
            <p className="text-sm md:text-base opacity-90 leading-relaxed">
              Acesse o IA Falaê e melhore sua fluência com feedback em tempo real.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate("/voice-lab")}
            className="bg-white text-primary hover:bg-white/95 shadow-soft-lg press-effect font-bold"
          >
            Ir ao IA Falaê
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
