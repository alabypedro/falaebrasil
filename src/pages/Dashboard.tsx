import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, BookOpen, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "XP Total", value: "1.250", icon: Zap, color: "bg-xp/15 text-xp" },
  { label: "Nível de Fluência", value: "A2", icon: Trophy, color: "bg-accent/15 text-accent" },
  { label: "Aulas Concluídas", value: "24", icon: BookOpen, color: "bg-success/15 text-success" },
  { label: "Streak", value: "7 dias", icon: Flame, color: "bg-destructive/15 text-destructive" },
];

const tracks = [
  { name: "Adults — A1", progress: 100 },
  { name: "Adults — A2", progress: 62 },
  { name: "Adults — B1", progress: 0 },
  { name: "Teens — A1", progress: 45 },
];

const nextLessons = [
  { title: "Greetings & Introductions", level: "A2", module: "Adults" },
  { title: "Daily Routines", level: "A2", module: "Adults" },
  { title: "At the Restaurant", level: "A1", module: "Teens" },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo de volta! Continue sua jornada de aprendizado.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.color}`}>
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

      {/* Tracks progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso por Trilha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tracks.map((track) => (
            <div key={track.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{track.name}</span>
                <span className="text-xs text-muted-foreground">{track.progress}%</span>
              </div>
              <Progress value={track.progress} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next lessons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas Aulas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextLessons.map((lesson, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate("/courses")}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
                  <BookOpen className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">{lesson.module}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{lesson.level}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="text-lg font-bold">Pratique sua pronúncia agora!</h3>
            <p className="text-sm opacity-80 mt-1">
              Acesse o Laboratório de Voz e melhore sua fluência com feedback em tempo real.
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate("/voice-lab")}
          >
            Ir ao Laboratório
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
