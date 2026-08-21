import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useStudentCategories } from "@/hooks/useStudentCategories";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, Circle, PlayCircle, FileText, ArrowLeft, BookOpen, HelpCircle, Mic, RotateCcw, Check, Zap, MessageSquareText, Headphones, Brain, BookText } from "lucide-react";
import { toast } from "sonner";
import InlineQuiz from "@/components/InlineQuiz";
import { PdfReader } from "@/components/library/PdfReader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  thumbnail_url: string | null;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  practice_text: string | null;
  display_order: number;
}

interface LessonVideo {
  id: string;
  lesson_id: string;
  title: string;
  video_url: string;
  display_order: number;
}

const levelColors: Record<string, string> = {
  A1: "bg-success/15 text-success",
  A2: "bg-accent/15 text-accent",
  B1: "bg-xp/15 text-xp",
  B2: "bg-innovation/15 text-innovation",
};

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (ytMatch) {
    // Mesma lógica centralizada para bloquear compartilhamento e logo do YouTube
    // Adicionamos autoplay=1 para conveniência e disablekb=1 para segurança extra
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&controls=1&disablekb=1`;
  }
  return url;
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile, refreshProfile } = useAuth();
  const { isAdmin } = useAdmin();
  const { hasOpen } = useStudentCategories();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [lessonQuizId, setLessonQuizId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [lessonVideos, setLessonVideos] = useState<LessonVideo[]>([]);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [completedVideos, setCompletedVideos] = useState<Set<string>>(new Set());
  const [markingVideo, setMarkingVideo] = useState(false);
  const [allCourseVideos, setAllCourseVideos] = useState<{ id: string; lesson_id: string }[]>([]);
  const [completedCourseVideos, setCompletedCourseVideos] = useState<Set<string>>(new Set());
  const [hasIndividualGrant, setHasIndividualGrant] = useState(false);
  const [readingPdf, setReadingPdf] = useState<{ url: string; title: string } | null>(null);

  const loadData = async () => {
    if (!courseId || !user) return;

    const [{ data: courseData }, { data: modulesData }, { data: progressData }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("modules").select("*").eq("course_id", courseId).order("display_order"),
      supabase.from("user_progress").select("lesson_id").eq("user_id", user.id),
    ]);

    // Cursos liberados individualmente (define o segmento efetivo do aluno)
    const { data: grantRows } = await supabase
      .from("user_course_access")
      .select("course_id, courses(required_tier)")
      .eq("user_id", user.id);
    const grants = (grantRows as any[]) ?? [];
    setHasIndividualGrant(grants.some((g) => g.course_id === courseId));
    setGrantedTiers(grants.map((g) => g.courses?.required_tier ?? null));


    if (courseData) setCourse(courseData);
    if (modulesData) {
      setModules(modulesData);
      const moduleIds = modulesData.map((m) => m.id);
      if (moduleIds.length > 0) {
        const { data: lessonsData } = await supabase
          .from("lessons")
          .select("*")
          .in("module_id", moduleIds)
          .order("display_order");
        if (lessonsData) {
          // Sort lessons by module display_order, then lesson display_order
          const moduleOrder: Record<string, number> = {};
          modulesData.forEach((m) => { moduleOrder[m.id] = m.display_order; });
          const ordered = [...lessonsData].sort((a, b) => {
            const mo = (moduleOrder[a.module_id] ?? 0) - (moduleOrder[b.module_id] ?? 0);
            if (mo !== 0) return mo;
            return (a.display_order ?? 0) - (b.display_order ?? 0);
          });
          setLessons(ordered);
          // Load all videos for this course + user's completion
          const lessonIds = ordered.map(l => l.id);
          const { data: vids } = await supabase
            .from("lesson_videos")
            .select("id, lesson_id")
            .in("lesson_id", lessonIds);
          const allVids = (vids ?? []) as { id: string; lesson_id: string }[];
          setAllCourseVideos(allVids);
          if (allVids.length > 0) {
            const { data: prog } = await supabase
              .from("user_video_progress")
              .select("video_id")
              .eq("user_id", user.id)
              .in("video_id", allVids.map(v => v.id));
            setCompletedCourseVideos(new Set((prog ?? []).map(p => p.video_id)));
          } else {
            setCompletedCourseVideos(new Set());
          }
          const requestedLessonId = searchParams.get("lesson");
          const requested = requestedLessonId ? ordered.find(l => l.id === requestedLessonId) : null;
          if (requested) {
            setActiveLesson(requested);
            // clean the query string so it doesn't stick on subsequent navigations
            const next = new URLSearchParams(searchParams);
            next.delete("lesson");
            setSearchParams(next, { replace: true });
          } else if (!activeLesson && ordered.length > 0) {
            // Resume: find first lesson (Unit) where not all videos watched OR quiz not passed.
            const completedVidSet = new Set((allVids.length > 0
              ? (await supabase
                  .from("user_video_progress")
                  .select("video_id")
                  .eq("user_id", user.id)
                  .in("video_id", allVids.map(v => v.id))
                ).data ?? []
              : []
            ).map(p => p.video_id));

            const lessonIdsAll = ordered.map(l => l.id);
            const { data: quizzesData } = await supabase
              .from("quizzes")
              .select("id, lesson_id")
              .in("lesson_id", lessonIdsAll);
            const allQuizzes = (quizzesData ?? []) as { id: string; lesson_id: string }[];
            const { data: attemptsData } = allQuizzes.length > 0 ? await supabase
              .from("quiz_attempts")
              .select("quiz_id, passed")
              .eq("user_id", user.id)
              .in("quiz_id", allQuizzes.map(q => q.id)) : { data: [] as any[] };
            const passedQuizIds = new Set((attemptsData ?? []).filter((a: any) => a.passed).map((a: any) => a.quiz_id));

            const resumeLesson = ordered.find((l) => {
              const lVids = allVids.filter(v => v.lesson_id === l.id);
              const lQuizzes = allQuizzes.filter(q => q.lesson_id === l.id);
              const allVidsDone = lVids.length > 0 && lVids.every(v => completedVidSet.has(v.id));
              const allQuizzesDone = lQuizzes.every(q => passedQuizIds.has(q.id));
              return !(allVidsDone && allQuizzesDone);
            }) ?? ordered[ordered.length - 1];
            setActiveLesson(resumeLesson);
          }
        }
      }
    }
    if (progressData) {
      setCompletedLessons(new Set(progressData.map((p) => p.lesson_id)));
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [courseId, user]);

  // Load quiz for active lesson
  useEffect(() => {
    if (!activeLesson) { setLessonQuizId(null); return; }
    const loadQuiz = async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("id")
        .eq("lesson_id", activeLesson.id)
        .limit(1)
        .maybeSingle();
      setLessonQuizId(data?.id ?? null);
    };
    loadQuiz();
  }, [activeLesson?.id]);

  // Load videos for active lesson
  useEffect(() => {
    if (!activeLesson) { setLessonVideos([]); setActiveVideoIdx(0); return; }
    const loadVideos = async () => {
      const { data } = await supabase
        .from("lesson_videos")
        .select("id, lesson_id, title, video_url, display_order")
        .eq("lesson_id", activeLesson.id)
        .order("display_order");
      let videos = (data ?? []) as LessonVideo[];
      // Fallback para o video_url legado se não houver registros novos
      if (videos.length === 0 && activeLesson.video_url) {
        videos = [{
          id: `legacy-${activeLesson.id}`,
          lesson_id: activeLesson.id,
          title: "Videoaula 1",
          video_url: activeLesson.video_url,
          display_order: 0,
        }];
      }
      setLessonVideos(videos);
      setActiveVideoIdx(0);
      // Carrega quais vídeos desta aula já foram concluídos
      const realIds = videos.filter(v => !v.id.startsWith("legacy-")).map(v => v.id);
      if (user && realIds.length > 0) {
        const { data: prog } = await supabase
          .from("user_video_progress")
          .select("video_id")
          .eq("user_id", user.id)
          .in("video_id", realIds);
        setCompletedVideos(new Set((prog ?? []).map(p => p.video_id)));
      } else {
        setCompletedVideos(new Set());
      }
    };
    loadVideos();
  }, [activeLesson?.id, user?.id]);

  const handleVideoComplete = async (videoId: string) => {
    if (!user || !videoId || videoId.startsWith("legacy-")) return;
    setMarkingVideo(true);
    const isDone = completedVideos.has(videoId);
    if (isDone) {
      const { data, error } = await supabase.rpc("uncomplete_video", { _video_id: videoId });
      setMarkingVideo(false);
      if (error) {
        toast.error("Não foi possível desmarcar o vídeo");
        return;
      }
      setCompletedVideos(prev => { const next = new Set(prev); next.delete(videoId); return next; });
      setCompletedCourseVideos(prev => { const next = new Set(prev); next.delete(videoId); return next; });
      const result = data as { removed?: boolean; xp_deducted?: number } | null;
      if (result?.removed && (result.xp_deducted ?? 0) > 0) {
        toast.success(`Vídeo desmarcado • -${result.xp_deducted} XP`);
        refreshProfile();
      } else {
        toast.success("Vídeo desmarcado");
      }
    } else {
      const { data, error } = await supabase.rpc("complete_video", { _video_id: videoId });
      setMarkingVideo(false);
      if (error) {
        toast.error("Não foi possível registrar o vídeo");
        return;
      }
      setCompletedVideos(prev => new Set(prev).add(videoId));
      setCompletedCourseVideos(prev => new Set(prev).add(videoId));
      const result = data as { awarded?: boolean; xp_earned?: number } | null;
      if (result?.awarded && (result.xp_earned ?? 0) > 0) {
        toast.success(`+${result.xp_earned} XP! Vídeo concluído 🎉`);
        refreshProfile();
      } else {
        toast.success("Vídeo marcado como assistido");
      }
    }
  };

  const toggleComplete = async (lessonId: string) => {
    if (!user) return;
    setMarking(true);

    if (completedLessons.has(lessonId)) {
      await supabase.from("user_progress").delete().eq("user_id", user.id).eq("lesson_id", lessonId);
      setCompletedLessons((prev) => { const next = new Set(prev); next.delete(lessonId); return next; });
      toast.success("Aula desmarcada");
    } else {
      await supabase.from("user_progress").insert({ user_id: user.id, lesson_id: lessonId });
      setCompletedLessons((prev) => new Set(prev).add(lessonId));
      toast.success("Aula concluída! 🎉");
    }
    setMarking(false);
  };

  const handleResetCourse = async () => {
    if (!user || !courseId) return;
    setResetting(true);
    const { error } = await supabase.rpc("reset_course_progress", { _course_id: courseId });
    if (error) {
      toast.error(error.message || "Erro ao resetar progresso");
    } else {
      setCompletedLessons(new Set());
      toast.success("Progresso do curso resetado! 🔄");
    }
    setResetting(false);
  };

  const totalVideos = allCourseVideos.length;
  const completedVideosCount = allCourseVideos.filter(v => completedCourseVideos.has(v.id)).length;
  const progressPct = totalVideos > 0 ? Math.round((completedVideosCount / totalVideos) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Curso não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/courses")}>Voltar</Button>
      </div>
    );
  }

  // Hierarquia de segmentos: Kids só acessa Kids; Teens acessa Teens + Kids; Adultos acessa tudo.
  const userTier = (profile?.plan_tier ?? "open").toLowerCase();
  const courseTier = ((course as any).required_tier ?? "open").toLowerCase();
  const segmentAllowed =
    isAdmin ||
    (userTier === "kids"
      ? courseTier === "kids"
      : userTier === "teens"
      ? ["teens", "kids"].includes(courseTier)
      : true);

  if (!segmentAllowed) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Conteúdo indisponível</h1>
        <p className="text-muted-foreground">
          Este curso não faz parte do seu segmento de estudos.
        </p>
        <Button onClick={() => navigate("/courses")}>Ver meus cursos</Button>
      </div>
    );
  }

  // Gating: bloqueia conteúdo se usuário não comprou o Essential Pro A1 (admins veem tudo)
  // Regra: categoria OPEN libera todos os cursos.
  if (!isAdmin && !hasOpen && !profile?.has_course_access && !hasIndividualGrant) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Conteúdo bloqueado</h1>
        <p className="text-muted-foreground">
          Para acessar o curso <strong>{course.title}</strong> você precisa adquirir o curso <strong>Falaê Brasil!</strong>.
        </p>
        <Button onClick={() => navigate("/courses")}>Ver detalhes do curso</Button>
      </div>
    );
  }


  const activeVideo = lessonVideos[activeVideoIdx] ?? null;
  const embedUrl = activeVideo?.video_url ? getEmbedUrl(activeVideo.video_url) : null;
  const isDirectVideo = embedUrl && (embedUrl.includes("supabase") || embedUrl.match(/\.(mp4|webm|ogg)$/i));

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/courses")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {course.thumbnail_url && (
              <img src={course.thumbnail_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
                <Badge className={`${levelColors[course.level] || ""} border-0`}>{course.level}</Badge>
              </div>
              {course.description && <p className="text-sm text-muted-foreground mt-1">{course.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Progress value={progressPct} className="h-2 flex-1 max-w-xs" />
            <span className="text-xs text-muted-foreground">{completedVideosCount}/{totalVideos} aulas • {progressPct}%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Video / Content area */}
        <div className="space-y-4">
          {activeLesson ? (
            <>
              {embedUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black" onContextMenu={(e) => e.preventDefault()}>
                  {isDirectVideo ? (
                    <video
                      src={embedUrl}
                      controls
                      className="w-full h-full"
                      onEnded={() => activeVideo && handleVideoComplete(activeVideo.id)}
                    />
                  ) : (
                    <>
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      {/* Camadas de proteção invisíveis para dificultar o compartilhamento */}
                      {/* Topo: Bloqueia Título, Compartilhar e Assistir mais tarde */}
                      <div className="absolute top-0 left-0 w-full h-[60px] z-10 cursor-default" />
                      {/* Cantos inferiores: Bloqueia botões de compartilhamento extras e logo do YouTube */}
                      <div className="absolute bottom-0 right-0 w-[120px] h-[50px] z-10 cursor-default" />
                      <div className="absolute bottom-0 left-0 w-[80px] h-[50px] z-10 cursor-default" />
                      {/* Bloqueia o botão de legendas (CC) do YouTube */}
                      <div className="absolute bottom-0 right-[120px] w-[45px] h-[40px] z-10 cursor-default" />
                    </>
                  )}
                </div>
              )}

              {activeVideo && !activeVideo.id.startsWith("legacy-") && (
                <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2 text-sm">
                    {completedVideos.has(activeVideo.id) ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-muted-foreground">Vídeo concluído</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 text-xp" />
                        <span className="text-muted-foreground">
                          Assista até o fim e marque como concluído para ganhar <strong>+25 XP</strong>
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={completedVideos.has(activeVideo.id) ? "outline" : "default"}
                    disabled={markingVideo}
                    onClick={() => handleVideoComplete(activeVideo.id)}
                    title={completedVideos.has(activeVideo.id) ? "Clique para desmarcar" : "Clique para marcar como assistido"}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {completedVideos.has(activeVideo.id) ? "Concluído" : "Marcar como assistido"}
                  </Button>
                </div>
              )}

              {lessonVideos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {lessonVideos.map((v, i) => (
                    <Button
                      key={v.id}
                      size="sm"
                      variant={i === activeVideoIdx ? "default" : "outline"}
                      onClick={() => setActiveVideoIdx(i)}
                      className="text-xs"
                    >
                      {completedVideos.has(v.id) ? (
                        <CheckCircle className="h-3.5 w-3.5 mr-1 text-success" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      )}
                      {v.title || `Videoaula ${i + 1}`}
                    </Button>
                  ))}
                </div>
              )}

              {!embedUrl && (
                <Card className="aspect-video flex items-center justify-center bg-muted/30">
                  <div className="text-center text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sem vídeo para esta aula</p>
                  </div>
                </Card>
              )}

              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-semibold text-foreground break-words">{activeLesson.title}</h2>
                      {activeLesson.description && (
                        <p className="text-sm text-muted-foreground mt-1 break-words">{activeLesson.description}</p>
                      )}
                    </div>
                     <div className="flex flex-col gap-2 md:flex-shrink-0">
                        <div className="grid grid-cols-3 gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem("ai-return-url", `/courses/${courseId}?lesson=${activeLesson.id}`);
                              navigate(`/memorizae`);
                            }}
                            className="w-full"
                          >
                            <Brain className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">IA Memorizaê</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem("ai-return-url", `/courses/${courseId}?lesson=${activeLesson.id}`);
                              const unitMatch = activeLesson.title.match(/unit\s*0*(\d+)/i);
                              const params = new URLSearchParams();
                              if (course?.level) params.set('level', course.level);
                              if (unitMatch) params.set('unit', unitMatch[1]);
                              const qs = params.toString();
                              navigate(`/listening-lab${qs ? `?${qs}` : ''}`);
                            }}
                            className="w-full"
                          >
                            <Headphones className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">IA Escutaê</span>
                          </Button>
                          {activeLesson.practice_text ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                sessionStorage.setItem("ai-return-url", `/courses/${courseId}?lesson=${activeLesson.id}`);
                                navigate(`/voice-lab?lesson=${activeLesson.id}`);
                              }}
                              className="w-full"
                            >
                              <Mic className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">IA Falaê</span>
                            </Button>
                          ) : (
                            <div />
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem("ai-return-url", `/courses/${courseId}?lesson=${activeLesson.id}`);
                              navigate(`/leiae`);
                            }}
                            className="w-full"
                          >
                            <BookText className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">IA Leiaê</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem("ai-return-url", `/courses/${courseId}?lesson=${activeLesson.id}`);
                              navigate(`/writing-lab${course?.level ? `?level=${course.level}` : ''}`);
                            }}
                            className="w-full"
                          >
                            <MessageSquareText className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">IA Escreveaê</span>
                          </Button>
                          {activeLesson.pdf_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReadingPdf({ url: activeLesson.pdf_url!, title: activeLesson.title })}
                              className="w-full"
                            >
                              <FileText className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">PDF</span>
                            </Button>
                          )}
                        </div>
                      </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inline Quiz */}
              {lessonQuizId && (() => {
                const idx = lessons.findIndex(l => l.id === activeLesson.id);
                const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
                return (
                  <InlineQuiz
                    quizId={lessonQuizId}
                    hasNext={!!next}
                    onNext={next ? () => {
                      setActiveLesson(next);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } : undefined}
                  />
                );
              })()}
            </>
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              <p>Selecione uma aula para começar.</p>
            </Card>
          )}
        </div>

        {/* Sidebar - Modules & Lessons */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conteúdo do Curso</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nenhum módulo cadastrado.</p>
            ) : (
              <Accordion type="multiple" defaultValue={modules.map((m) => m.id)} className="w-full">
                {modules.map((mod) => {
                  const modLessons = lessons.filter((l) => l.module_id === mod.id);
                  const modVideos = allCourseVideos.filter(v => modLessons.some(l => l.id === v.lesson_id));
                  const modCompleted = modVideos.filter(v => completedCourseVideos.has(v.id)).length;
                  const modTotal = modVideos.length;
                  return (
                    <AccordionItem key={mod.id} value={mod.id} className="border-b-0">
                      <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <span className="font-medium">{mod.title}</span>
                          <span className="text-[10px] text-muted-foreground">{modCompleted}/{modTotal}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        {modLessons.map((lesson) => {
                          const isActive = activeLesson?.id === lesson.id;
                          const lessonVids = allCourseVideos.filter(v => v.lesson_id === lesson.id);
                          const isDone = lessonVids.length > 0 && lessonVids.every(v => completedCourseVideos.has(v.id));
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setActiveLesson(lesson)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                isActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted/50 text-foreground"
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                              ) : (
                                <PlayCircle className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                              )}
                              <span className="truncate">{lesson.title}</span>
                              {lesson.video_url && <PlayCircle className="h-3 w-3 ml-auto text-muted-foreground flex-shrink-0 opacity-50" />}
                            </button>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      {readingPdf && (
        <PdfReader
          isOpen={!!readingPdf}
          onClose={() => setReadingPdf(null)}
          url={readingPdf.url}
          title={readingPdf.title}
          allowDownload
        />
      )}
    </div>
  );
}
