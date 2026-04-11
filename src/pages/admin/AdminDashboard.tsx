import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Layers, FileText, HelpCircle, Users } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ courses: 0, modules: 0, lessons: 0, quizzes: 0 });

  useEffect(() => {
    const load = async () => {
      const [c, m, l, q] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        courses: c.count ?? 0,
        modules: m.count ?? 0,
        lessons: l.count ?? 0,
        quizzes: q.count ?? 0,
      });
    };
    load();
  }, []);

  const items = [
    { label: "Cursos", value: stats.courses, icon: BookOpen },
    { label: "Módulos", value: stats.modules, icon: Layers },
    { label: "Lições", value: stats.lessons, icon: FileText },
    { label: "Quizzes", value: stats.quizzes, icon: HelpCircle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
