import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, BookOpen, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OnboardingTutorialModal from "@/components/OnboardingTutorialModal";

interface CourseProgress {
  name: string;
  progress: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: courses } = await supabase.from("courses").select("id, title").eq("published", true).order("display_order");
      const { data: modules } = await supabase.from("modules").select("id, course_id");
      const { data: lessons } = await supabase.from("lessons").select("id, module_id");
      const { data: progress } = await supabase.from("user_progress").select("lesson_id").eq("user_id", user.id);

      const completedIds = new Set((progress || []).map((p) => p.lesson_id));
      setCompletedCount(completedIds.size);

      const modCourse: Record<string, string> = {};
      (modules || []).forEach((m) => { modCourse[m.id] = m.course_id; });

      const courseLessons: Record<string, string[]> = {};
      (lessons || []).forEach((l) => {
        const cid = modCourse[l.module_id];
        if (cid) { if (!courseLessons[cid]) courseLessons[cid] = []; courseLessons[cid].push(l.id); }
      });

      const result = (courses || []).map((c) => {
        const ids = courseLessons[c.id] || [];
        const done = ids.filter((id) => completedIds.has(id)).length;
        return { name: c.title, progress: ids.length > 0 ? Math.round((done / ids.length) * 100) : 0 };
      });
      setCourseProgress(result);
    };
    load();
  }, [user]);

  const stats = [
    { label: "XP Total", value: String(profile?.xp ?? 0), icon: Zap, gradient: "bg-gradient-xp", iconColor: "text-xp-foreground" },
    { label: "Nível de Fluência", value: profile?.level ?? "A1", icon: Trophy, gradient: "bg-gradient-accent", iconColor: "text-accent-foreground" },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            className="animate-fade-up hover-lift card-shine cursor-default border-border/50 overflow-hidden relative"
            style={{ "--delay": `${80 * (i + 1)}ms` } as React.CSSProperties}
          >
            <CardContent className="flex items-center gap-4 p-5 relative">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.gradient} shadow-soft-md hover-bounce`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-display font-extrabold text-foreground tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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
