import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Lock, Zap, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { UpsellModal } from "@/components/UpsellModal";
import { useAdmin } from "@/hooks/useAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStudentCategories } from "@/hooks/useStudentCategories";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import { courseSegment, segmentAllows, userSegment } from "@/lib/segments";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  C1: "bg-primary/15 text-primary",
  C2: "bg-destructive/15 text-destructive",
};

const levelBadgeLabels: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
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
  lockReason,
  onLockedClick,
}: {
  course: CourseWithProgress;
  index: number;
  lockReason: null | "purchase" | "segment";
  onLockedClick: (reason: "purchase" | "segment") => void;
}) {
  const navigate = useNavigate();
  const locked = lockReason !== null;
  return (
    <Card
      className="relative overflow-hidden hover-lift cursor-pointer animate-fade-up"
      style={{ "--delay": `${80 * (index + 1)}ms` } as React.CSSProperties}
      onClick={() => (lockReason ? onLockedClick(lockReason) : navigate(`/courses/${course.id}`))}
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
        {lockReason === "segment" ? (
          <Badge variant="secondary" className="w-full justify-center py-1.5 gap-1.5">
            <Lock className="h-3 w-3" /> Bloqueado para o seu segmento
          </Badge>
        ) : lockReason === "purchase" ? (
          <Badge variant="default" className="w-full justify-center py-1.5 gap-1.5">
            <Lock className="h-3 w-3" /> Comprar Falaê Brasil!
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
  const [showSegmentBlock, setShowSegmentBlock] = useState(false);
  const [coursePrice, setCoursePrice] = useState<{ display_name: string; checkout_url: string | null } | null>(null);
  const [grantedCourseIds, setGrantedCourseIds] = useState<Set<string>>(new Set());
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const { hasOpen } = useStudentCategories();

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: prodData } = await supabase
        .from("payment_products")
        .select("name, price_cents, type")
        .eq("product_key", "plano_open")
        .eq("active", true)
        .maybeSingle();
      if (prodData) setCoursePrice({ display_name: prodData.name, checkout_url: null });

      const { data: granted } = await supabase
        .from("user_course_access")
        .select("course_id")
        .eq("user_id", user.id);
      setGrantedCourseIds(new Set((granted ?? []).map((g: any) => g.course_id)));

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
      <div className="space-y-6 max-w-6xl page-transition">
        <div className="animate-fade-up">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="space-y-8 mt-8">
          {[1, 2].map((group) => (
            <section key={group} className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="overflow-hidden border-border/50">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                      <div className="space-y-2 pt-2">
                        <Skeleton className="h-1.5 w-full" />
                        <div className="flex justify-between">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // Regra: aluno com categoria OPEN tem acesso total a todos os cursos.
  const isLocked = !isAdmin && !hasOpen && !profile?.has_course_access && grantedCourseIds.size === 0;

  // Hierarquia de segmentos: Kids < Teens < Adultos.
  // Kids => só Kids | Teens => Teens + Kids | Adultos (open/pro/vip) => tudo.
  const grantedTiers = courses.filter((c) => grantedCourseIds.has(c.id)).map((c) => c.required_tier);
  const mySegment = userSegment({
    isAdmin,
    hasOpen,
    planTier: profile?.plan_tier,
    grantedTiers,
  });

  const groups: { key: string; title: string; tiers: string[] }[] = [
    { key: "adults", title: t("courses.group.adults"), tiers: ["open", "pro", "vip"] },
    { key: "teens", title: t("courses.group.teens"), tiers: ["teens"] },
    { key: "kids", title: t("courses.group.kids"), tiers: ["kids"] },
  ];

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      courses: courses.filter((c) =>
        g.tiers.includes((c.required_tier ?? "open").toLowerCase())
      ),
    }))
    .filter((g) => g.courses.length > 0);

  const lockReasonFor = (course: CourseWithProgress): null | "purchase" | "segment" => {
    if (isAdmin) return null;
    if (!segmentAllows(mySegment, courseSegment(course.required_tier))) return "segment";
    if (isLocked) return "purchase";
    return null;
  };

  return (
    <div className="space-y-6 max-w-6xl page-transition">
      <BackToDashboardButton className="-ml-2 text-muted-foreground hover:text-foreground" />
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground">{t("courses.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("courses.subtitle")}</p>
      </div>

      <div
        className="animate-fade-up space-y-8"
        style={{ "--delay": "100ms" } as React.CSSProperties}
      >
        {visibleGroups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {group.courses.map((course, i) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={i}
                  lockReason={lockReasonFor(course)}
                  onLockedClick={(reason) =>
                    reason === "segment" ? setShowSegmentBlock(true) : setShowUpsell(true)
                  }
                />
              ))}
            </div>
          </section>
        ))}

        {visibleGroups.length === 0 && (
          <p className="text-center text-muted-foreground py-8 animate-fade-in">{t("courses.empty")}</p>
        )}
      </div>

      <UpsellModal
        open={showUpsell}
        onOpenChange={setShowUpsell}
        productKey="plano_open"
        productName={coursePrice?.display_name ?? "Plano OPEN"}
        description="Para acessar o conteúdo do curso Falaê Brasil! você precisa adquirir o curso."
      />

      <Dialog open={showSegmentBlock} onOpenChange={setShowSegmentBlock}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle>Curso bloqueado</DialogTitle>
            <DialogDescription>
              Este curso pertence a outro segmento de estudos e não está disponível no seu plano
              atual. Fale com a equipe Falaê Brasil! para liberar o acesso.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
