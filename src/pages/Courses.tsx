import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Lock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { UpsellModal } from "@/components/UpsellModal";
import { useAdmin } from "@/hooks/useAdmin";

interface CourseWithProgress {
  id: string;
  title: string;
  level: string;
  category: string;
  description: string | null;
  thumbnail_url: string | null;
  required_tier: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  earnedXp: number;
  totalXp: number;
}

const levelColors: Record<string, string> = {
  A1: "bg-success/15 text-success",
  A2: "bg-accent/15 text-accent",
  B1: "bg-xp/15 text-xp",
  B2: "bg-innovation/15 text-innovation",
};

const levelBadgeLabels: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
};

const courseTitleLabels: Record<string, string> = {
   A1: "FB Pós-Int (B2)",
  A2: "FB A2",
  B1: "FB B1",
  B2: "FB Interm (B1)",
};

function CourseCard({
  course,
  index,
  locked,
  onLockedClick,
}: {
  course: CourseWithProgress;
  index: number;
  locked: boolean;
  onLockedClick: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className="relative overflow-hidden hover-lift cursor-pointer animate-fade-up"
      style={{ "--delay": `${80 * (index + 1)}ms` } as React.CSSProperties}
      onClick={() => (locked ? onLockedClick() : navigate(`/courses/${course.id}`))}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {course.thumbnail_url && (
              <img
                src={course.thumbnail_url}
                alt=""
                className={`h-12 w-12 rounded object-cover flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${locked ? "grayscale" : ""}`}
              />
            )}
            <div>
              <Badge className={`text-[10px] ${levelColors[course.level] || ""} border-0`}>
                {levelBadgeLabels[course.level] || course.level}
              </Badge>
              <h3 className="text-sm font-semibold text-foreground mt-2">
                {courseTitleLabels[course.title] || course.title}
              </h3>
              {course.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{course.description}</p>
              )}
              <p className="text-xs text-muted-foreground">{course.totalLessons} Módulos</p>
            </div>
          </div>
          {locked ? (
            <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : course.progress === 100 && course.totalLessons > 0 ? (
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0 animate-xp-pop" />
          ) : null}
        </div>
        {locked ? (
          <Badge variant="default" className="w-full justify-center py-1.5 gap-1.5">
            <Lock className="h-3 w-3" /> Comprar Essential Pro A1
          </Badge>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span>{course.progress}%</span>
              </div>
              <Progress value={course.progress} className="h-1.5" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-xp font-medium">
                <Zap className="h-3 w-3 fill-xp/30" />
                {course.earnedXp} XP
              </span>
              <span className="text-muted-foreground tabular-nums">
                / {course.totalXp} XP
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Courses() {
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpsell, setShowUpsell] = useState(false);
  const [coursePrice, setCoursePrice] = useState<{ display_name: string; checkout_url: string | null } | null>(null);
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: prodData } = await supabase
        .from("hubla_product_mapping")
        .select("display_name, checkout_url")
        .eq("product_key", "essencial_pro_a1")
        .maybeSingle();
      if (prodData) setCoursePrice(prodData as any);

      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, title, level, category, description, thumbnail_url, required_tier")
        .eq("published", true)
        .order("display_order");

      if (!coursesData) { setLoading(false); return; }

      const { data: modules } = await supabase.from("modules").select("id, course_id");
      const { data: lessons } = await supabase.from("lessons").select("id, module_id");
      const { data: videos } = await supabase.from("lesson_videos").select("id, lesson_id");
      const { data: videoProgress } = await supabase
        .from("user_video_progress")
        .select("video_id")
        .eq("user_id", user.id);
      const { data: quizzes } = await supabase.from("quizzes").select("id, lesson_id");
      const { data: quizQuestions } = await supabase
        .from("quiz_questions_public" as any)
        .select("id, quiz_id");
      const { data: quizAttempts } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, passed")
        .eq("user_id", user.id);

      const moduleToCourseLookup: Record<string, string> = {};
      (modules || []).forEach((m) => { moduleToCourseLookup[m.id] = m.course_id; });

      // Map lesson -> course for videos & quizzes
      const lessonToCourse: Record<string, string> = {};
      (lessons || []).forEach((l) => {
        const cid = moduleToCourseLookup[l.module_id];
        if (cid) lessonToCourse[l.id] = cid;
      });

      const completedVideoIds = new Set((videoProgress || []).map((v) => v.video_id));
      const courseVideos: Record<string, string[]> = {};
      (videos || []).forEach((v) => {
        const cid = lessonToCourse[v.lesson_id];
        if (!cid) return;
        if (!courseVideos[cid]) courseVideos[cid] = [];
        courseVideos[cid].push(v.id);
      });

      // Best score per quiz
      const bestScoreByQuiz: Record<string, { score: number; passed: boolean }> = {};
      (quizAttempts || []).forEach((a) => {
        const cur = bestScoreByQuiz[a.quiz_id];
        if (!cur || a.score > cur.score) {
          bestScoreByQuiz[a.quiz_id] = { score: a.score, passed: a.passed };
        }
      });

      const questionsCountByQuiz: Record<string, number> = {};
      ((quizQuestions || []) as any[]).forEach((q: any) => {
        questionsCountByQuiz[q.quiz_id] = (questionsCountByQuiz[q.quiz_id] || 0) + 1;
      });

      const courseQuizzes: Record<string, string[]> = {};
      (quizzes || []).forEach((q) => {
        const cid = lessonToCourse[q.lesson_id];
        if (!cid) return;
        if (!courseQuizzes[cid]) courseQuizzes[cid] = [];
        courseQuizzes[cid].push(q.id);
      });

      const result: CourseWithProgress[] = coursesData.map((c) => {
        // Progress is based on watched videos vs total videos in course (matches CourseDetail & Dashboard)
        const vids = courseVideos[c.id] || [];
        const watched = vids.filter((id) => completedVideoIds.has(id)).length;
        const pct = vids.length > 0 ? Math.round((watched / vids.length) * 100) : 0;
        const videoXpEarned = watched * 25;
        const videoXpTotal = vids.length * 25;

        // XP from quizzes: per quiz, max = (questions * 5) + 25 bonus
        const qIds = courseQuizzes[c.id] || [];
        let quizXpEarned = 0;
        let quizXpTotal = 0;
        qIds.forEach((qid) => {
          const qCount = questionsCountByQuiz[qid] || 0;
          quizXpTotal += qCount * 5 + 25;
          const best = bestScoreByQuiz[qid];
          if (best) {
            const correct = Math.round((best.score / 100) * qCount);
            quizXpEarned += correct * 5 + (best.passed ? 25 : 0);
          }
        });

        return {
          ...c,
          totalLessons: (modules || []).filter((m) => m.course_id === c.id).length,
          completedLessons: watched,
          progress: pct,
          earnedXp: videoXpEarned + quizXpEarned,
          totalXp: videoXpTotal + quizXpTotal,
        };
      });

      setCourses(result);
      setLoading(false);
    };

    load();
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isLocked = !isAdmin && !profile?.has_course_access;

  const userTier = (profile?.plan_tier ?? "open").toLowerCase();
  const isTeens = userTier === "teens";
  const isKids = userTier === "kids";

  const allowedTiers: string[] = isAdmin
    ? ["open", "pro", "vip", "teens", "kids"]
    : isTeens
    ? ["teens"]
    : isKids
    ? ["kids"]
    : ["open", "pro", "vip"];

  const visibleCourses = courses.filter((c) =>
    allowedTiers.includes((c.required_tier ?? "open").toLowerCase())
  );

   const groups: { key: string; title: string; tiers: string[] }[] = [
     { key: "adults", title: "Adultos (18+)", tiers: ["open", "pro", "vip"] },
     { key: "teens", title: "TEENS (13 - 17 ANOS)", tiers: ["teens"] },
     { key: "kids", title: "KIDS (8 - 12 ANOS)", tiers: ["kids"] },
   ];

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      courses: visibleCourses.filter((c) =>
        g.tiers.includes((c.required_tier ?? "open").toLowerCase())
      ),
    }))
    .filter((g) => g.courses.length > 0);

  return (
    <div className="space-y-6 max-w-6xl page-transition">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground">Cursos Falaê Brasil! (FB)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trilhas de aprendizado — seu progresso em tempo real.
        </p>
      </div>

      <div
        className="animate-fade-up grid gap-6 lg:grid-cols-3"
        style={{ "--delay": "100ms" } as React.CSSProperties}
      >
        {visibleGroups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h2>
            <div className="grid gap-4 grid-cols-1">
              {group.courses.map((course, i) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={i}
                  locked={isLocked}
                  onLockedClick={() => setShowUpsell(true)}
                />
              ))}
            </div>
          </section>
        ))}
        {visibleGroups.length === 0 && (
          <p className="text-center text-muted-foreground py-8 animate-fade-in lg:col-span-3">
            Nenhum curso publicado.
          </p>
        )}
      </div>

      <UpsellModal
        open={showUpsell}
        onOpenChange={setShowUpsell}
        productKey="essencial_pro_a1"
        productName={coursePrice?.display_name ?? "Essential Pro A1"}
        checkoutUrl={coursePrice?.checkout_url ?? null}
        description="Para acessar o conteúdo do curso Essential Pro A1 você precisa adquirir o curso."
      />
    </div>
  );
}
