import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, BookOpen, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
    { label: "XP Total", value: String(profile?.xp ?? 0), icon: Zap, color: "bg-xp/15 text-xp" },
    { label: "Nível de Fluência", value: profile?.level ?? "A1", icon: Trophy, color: "bg-accent/15 text-accent" },
    { label: "Aulas Concluídas", value: String(completedCount), icon: BookOpen, color: "bg-success/15 text-success" },
    { label: "Streak", value: `${profile?.streak_days ?? 0} dias`, icon: Flame, color: "bg-destructive/15 text-destructive" },
  ];

  return (
    <div className="space-y-8 max-w-6xl page-transition">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo de volta! Continue sua jornada de aprendizado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            className="animate-fade-up hover-lift cursor-default"
            style={{ "--delay": `${80 * (i + 1)}ms` } as React.CSSProperties}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.color} hover-bounce`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {courseProgress.length > 0 && (
        <Card className="animate-fade-up" style={{ "--delay": "400ms" } as React.CSSProperties}>
          <CardHeader>
            <CardTitle className="text-base">Progresso por Curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {courseProgress.map((track, i) => (
              <div
                key={track.name}
                className="space-y-1.5 animate-fade-up"
                style={{ "--delay": `${450 + i * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{track.name}</span>
                  <span className="text-xs text-muted-foreground">{track.progress}%</span>
                </div>
                <Progress value={track.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card
        className="bg-primary text-primary-foreground animate-fade-up hover-lift glow-accent"
        style={{ "--delay": "550ms" } as React.CSSProperties}
      >
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="text-lg font-bold">Pratique sua pronúncia agora!</h3>
            <p className="text-sm opacity-80 mt-1">
              Acesse o Laboratório de Voz e melhore sua fluência com feedback em tempo real.
            </p>
          </div>
          <Button variant="secondary" size="lg" onClick={() => navigate("/voice-lab")} className="press-effect">
            Ir ao Laboratório
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
