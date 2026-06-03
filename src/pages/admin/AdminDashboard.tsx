import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, Layers, FileText, HelpCircle, AlertTriangle, Clock, ArrowRight, Video, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  courses: number;
  modules: number;
  lessons: number;
  quizzes: number;
}

interface IncompleteLesson {
  id: string;
  title: string;
  module_title: string;
  course_title: string;
  missing_video: boolean;
  missing_pdf: boolean;
}

interface RecentActivity {
  id: string;
  type: "course" | "lesson";
  title: string;
  updated_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ courses: 0, modules: 0, lessons: 0, quizzes: 0 });
  const [incompleteLessons, setIncompleteLessons] = useState<IncompleteLesson[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [c, m, l, q, lessonsData, coursesRecent, lessonsRecent] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id, title, video_url, pdf_url, modules(title, courses(title))").limit(100),
        supabase.from("courses").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(5),
        supabase.from("lessons").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(5),
      ]);

      setStats({
        courses: c.count ?? 0,
        modules: m.count ?? 0,
        lessons: l.count ?? 0,
        quizzes: q.count ?? 0,
      });

      if (lessonsData.data) {
        const incomplete = lessonsData.data
          .filter(lsn => !lsn.video_url || !lsn.pdf_url)
          .map(lsn => ({
            id: lsn.id,
            title: lsn.title,
            module_title: (lsn.modules as any)?.title || "Sem módulo",
            course_title: (lsn.modules as any)?.courses?.title || "Sem curso",
            missing_video: !lsn.video_url,
            missing_pdf: !lsn.pdf_url,
          }))
          .slice(0, 5);
        setIncompleteLessons(incomplete);
      }

      const combinedActivity: RecentActivity[] = [
        ...(coursesRecent.data?.map(i => ({ ...i, type: "course" as const })) || []),
        ...(lessonsRecent.data?.map(i => ({ ...i, type: "lesson" as const })) || []),
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8);
      
      setRecentActivity(combinedActivity);
      setLoading(false);
    };
    load();
  }, []);

  const statItems = [
    { label: "Cursos", value: stats.courses, icon: BookOpen, color: "text-blue-500" },
    { label: "Módulos", value: stats.modules, icon: Layers, color: "text-purple-500" },
    { label: "Lições", value: stats.lessons, icon: FileText, color: "text-emerald-500" },
    { label: "Quizzes", value: stats.quizzes, icon: HelpCircle, color: "text-amber-500" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20" />
            <CardContent className="h-12" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Auditoria de Conteúdo
              </CardTitle>
              <CardDescription>Lições que precisam de atenção (sem vídeo ou PDF)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {incompleteLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Tudo em dia! Todas as lições têm conteúdo.</p>
            ) : (
              <div className="space-y-4">
                {incompleteLessons.map((lsn) => (
                  <div key={lsn.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lsn.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{lsn.course_title} › {lsn.module_title}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {lsn.missing_video && (
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                          <Video className="h-3 w-3 mr-1" /> Vídeo
                        </Badge>
                      )}
                      {lsn.missing_pdf && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">
                          <FileDown className="h-3 w-3 mr-1" /> PDF
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 ml-2">
                        <Link to="/admin/lessons">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="link" size="sm" className="w-full text-xs" asChild>
                  <Link to="/admin/lessons">Ver todas as lições</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Atividade Recente
              </CardTitle>
              <CardDescription>Últimas atualizações no sistema</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={`${activity.type}-${activity.id}`} className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${activity.type === 'course' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {activity.type === 'course' ? <BookOpen className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.type === 'course' ? 'Curso' : 'Lição'} atualizada {format(new Date(activity.updated_at), "d 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade recente encontrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
