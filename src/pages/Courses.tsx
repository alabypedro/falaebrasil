import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface CourseWithProgress {
  id: string;
  title: string;
  level: string;
  category: string;
  description: string | null;
  thumbnail_url: string | null;
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

const levelColors: Record<string, string> = {
  A1: "bg-success/15 text-success",
  A2: "bg-accent/15 text-accent",
  B1: "bg-xp/15 text-xp",
  B2: "bg-innovation/15 text-innovation",
};

const categories = [
  { key: "all", label: "Todos" },
  { key: "transversal", label: "Transversal" },
  { key: "bst", label: "BST" },
];

function CourseCard({ course, index }: { course: CourseWithProgress; index: number }) {
  const navigate = useNavigate();
  return (
    <Card
      className="relative overflow-hidden hover-lift cursor-pointer animate-fade-up"
      style={{ "--delay": `${80 * (index + 1)}ms` } as React.CSSProperties}
      onClick={() => navigate(`/courses/${course.id}`)}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {course.thumbnail_url && (
              <img
                src={course.thumbnail_url}
                alt=""
                className="h-12 w-12 rounded object-cover flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <div>
              <Badge className={`text-[10px] ${levelColors[course.level] || ""} border-0`}>
                {course.level}
              </Badge>
              <h3 className="text-sm font-semibold text-foreground mt-2">{course.title}</h3>
              {course.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{course.description}</p>
              )}
              <p className="text-xs text-muted-foreground">{course.totalLessons} aulas</p>
            </div>
          </div>
          {course.progress === 100 && course.totalLessons > 0 ? (
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0 animate-xp-pop" />
          ) : null}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{course.progress}%</span>
          </div>
          <Progress value={course.progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Courses() {
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, title, level, category, description, thumbnail_url")
        .eq("published", true)
        .order("display_order");

      if (!coursesData) { setLoading(false); return; }

      const { data: modules } = await supabase.from("modules").select("id, course_id");
      const { data: lessons } = await supabase.from("lessons").select("id, module_id");
      const { data: progress } = await supabase.from("user_progress").select("lesson_id").eq("user_id", user.id);

      const completedLessonIds = new Set((progress || []).map((p) => p.lesson_id));
      const moduleToCourseLookup: Record<string, string> = {};
      (modules || []).forEach((m) => { moduleToCourseLookup[m.id] = m.course_id; });

      const courseLessons: Record<string, string[]> = {};
      (lessons || []).forEach((l) => {
        const courseId = moduleToCourseLookup[l.module_id];
        if (courseId) {
          if (!courseLessons[courseId]) courseLessons[courseId] = [];
          courseLessons[courseId].push(l.id);
        }
      });

      const result: CourseWithProgress[] = coursesData.map((c) => {
        const lessonIds = courseLessons[c.id] || [];
        const completed = lessonIds.filter((id) => completedLessonIds.has(id)).length;
        const pct = lessonIds.length > 0 ? Math.round((completed / lessonIds.length) * 100) : 0;
        return { ...c, totalLessons: lessonIds.length, completedLessons: completed, progress: pct };
      });

      setCourses(result);
      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl page-transition">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trilhas de aprendizado — seu progresso em tempo real.
        </p>
      </div>

      <Tabs defaultValue="all" className="animate-fade-up" style={{ "--delay": "100ms" } as React.CSSProperties}>
        <TabsList>
          {categories.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key} className="press-effect">{cat.label}</TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(cat.key === "all" ? courses : courses.filter((c) => c.category === cat.key)).map((course, i) => (
                <CourseCard key={course.id} course={course} index={i} />
              ))}
            </div>
            {(cat.key === "all" ? courses : courses.filter((c) => c.category === cat.key)).length === 0 && (
              <p className="text-center text-muted-foreground py-8 animate-fade-in">Nenhum curso publicado nesta categoria.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
