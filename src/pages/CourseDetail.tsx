import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, Circle, PlayCircle, FileText, ArrowLeft, BookOpen } from "lucide-react";
import { toast } from "sonner";

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
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Direct video or storage URL
  return url;
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const loadData = async () => {
    if (!courseId || !user) return;

    const [{ data: courseData }, { data: modulesData }, { data: progressData }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("modules").select("*").eq("course_id", courseId).order("display_order"),
      supabase.from("user_progress").select("lesson_id").eq("user_id", user.id),
    ]);

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
          setLessons(lessonsData);
          if (!activeLesson && lessonsData.length > 0) {
            setActiveLesson(lessonsData[0]);
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

  const totalLessons = lessons.length;
  const completedCount = lessons.filter((l) => completedLessons.has(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

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

  const embedUrl = activeLesson?.video_url ? getEmbedUrl(activeLesson.video_url) : null;
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
            <span className="text-xs text-muted-foreground">{completedCount}/{totalLessons} aulas • {progressPct}%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Video / Content area */}
        <div className="space-y-4">
          {activeLesson ? (
            <>
              {embedUrl && (
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  {isDirectVideo ? (
                    <video src={embedUrl} controls className="w-full h-full" />
                  ) : (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
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
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{activeLesson.title}</h2>
                      {activeLesson.description && (
                        <p className="text-sm text-muted-foreground mt-1">{activeLesson.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {activeLesson.pdf_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={activeLesson.pdf_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-1" /> PDF
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={completedLessons.has(activeLesson.id) ? "secondary" : "default"}
                        onClick={() => toggleComplete(activeLesson.id)}
                        disabled={marking}
                      >
                        {completedLessons.has(activeLesson.id) ? (
                          <><CheckCircle className="h-4 w-4 mr-1" /> Concluída</>
                        ) : (
                          <><Circle className="h-4 w-4 mr-1" /> Marcar como concluída</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                  const modCompleted = modLessons.filter((l) => completedLessons.has(l.id)).length;
                  return (
                    <AccordionItem key={mod.id} value={mod.id} className="border-b-0">
                      <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <span className="font-medium">{mod.title}</span>
                          <span className="text-[10px] text-muted-foreground">{modCompleted}/{modLessons.length}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        {modLessons.map((lesson) => {
                          const isActive = activeLesson?.id === lesson.id;
                          const isDone = completedLessons.has(lesson.id);
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
    </div>
  );
}
