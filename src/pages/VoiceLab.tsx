import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Square, RotateCcw, Loader2, BookOpen } from "lucide-react";
import FeedbackCard, { type FeedbackScores } from "@/components/FeedbackCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type NormalizedAzureResponse = {
  status?: string;
  transcription?: string;
  confidence?: number;
  snr?: number | null;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number;
  pronunciation: number;
};

function toNumberOrZero(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function normalizeAzureResponse(payload: any): NormalizedAzureResponse {
  console.log("Edge function payload received:", payload);

  return {
    status: payload?.status,
    transcription: payload?.transcription ?? undefined,
    confidence: typeof payload?.confidence === "number" ? payload.confidence : undefined,
    snr: typeof payload?.snr === "number" ? payload.snr : null,
    accuracy: toNumberOrZero(payload?.accuracy),
    fluency: toNumberOrZero(payload?.fluency),
    completeness: toNumberOrZero(payload?.completeness),
    prosody: toNumberOrZero(payload?.prosody),
    pronunciation: toNumberOrZero(payload?.pronunciation),
  };
}

const unscriptedTopics = [
  "Descreva seu fim de semana ideal em inglês.",
  "Fale sobre um lugar que você gostaria de visitar.",
  "Descreva sua rotina matinal.",
  "Conte sobre seu hobby favorito.",
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type LessonContext = { id: string; title: string; courseId: string; courseTitle: string };
type CourseOption = { id: string; title: string };
type CoursePhrase = { lessonId: string; text: string; moduleOrder: number; lessonOrder: number };

export default function VoiceLab() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lessonIdParam = searchParams.get("lesson");

  const [mode, setMode] = useState<"scripted" | "unscripted">("scripted");
  const [practiceText, setPracticeText] = useState<string>("");
  const [lessonContext, setLessonContext] = useState<LessonContext | null>(null);
  const [currentTopic, setCurrentTopic] = useState(unscriptedTopics[0]);
  const [feedback, setFeedback] = useState<FeedbackScores | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [analyzedId, setAnalyzedId] = useState<string | null>(null);

  // Course selector + phrases of the active course
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string>("");
  const [coursePhrases, setCoursePhrases] = useState<CoursePhrase[]>([]);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number>(0);

  const { user, profile } = useAuth();
  const userLevel = profile?.level || "A1";

  // Load all published courses for the selector
  useEffect(() => {
    const loadCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, published, display_order")
        .order("display_order");
      const list = ((data as any[]) || [])
        .filter((c) => c.published)
        .map((c) => ({ id: c.id, title: c.title }));
      setCourses(list);
    };
    loadCourses();
  }, []);

  // When entering via ?lesson=, lock the active course to that lesson's course
  useEffect(() => {
    if (!lessonIdParam) {
      setLessonContext(null);
      return;
    }
    const fetchFromLesson = async () => {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("id, title, practice_text, modules(id, title, course_id, courses(id, title))")
        .eq("id", lessonIdParam)
        .maybeSingle();

      if (lesson) {
        const mod: any = lesson.modules;
        const courseId = mod?.courses?.id ?? mod?.course_id ?? "";
        setLessonContext({
          id: lesson.id,
          title: lesson.title,
          courseId,
          courseTitle: mod?.courses?.title ?? "",
        });
        if (courseId) setActiveCourseId(courseId);
      }
    };
    fetchFromLesson();
  }, [lessonIdParam]);

  // Default to the first course when not opened from a specific lesson
  useEffect(() => {
    if (!activeCourseId && !lessonIdParam && courses.length > 0) {
      setActiveCourseId(courses[0].id);
    }
  }, [courses, activeCourseId, lessonIdParam]);

  // Fetch all practice phrases for the active course (no random, ordered)
  useEffect(() => {
    if (!activeCourseId) {
      setCoursePhrases([]);
      setPracticeText("");
      setPromptsLoading(false);
      return;
    }
    const loadPhrases = async () => {
      setPromptsLoading(true);
      const { data: mods } = await supabase
        .from("modules")
        .select("id, display_order, course_id, lessons(id, title, practice_text, display_order)")
        .eq("course_id", activeCourseId)
        .order("display_order");

      const phrases: CoursePhrase[] = [];
      ((mods as any[]) || []).forEach((m) => {
        ((m.lessons as any[]) || []).forEach((l) => {
          if (l.practice_text && String(l.practice_text).trim()) {
            phrases.push({
              lessonId: l.id,
              text: String(l.practice_text).trim(),
              moduleOrder: m.display_order ?? 0,
              lessonOrder: l.display_order ?? 0,
            });
          }
        });
      });
      phrases.sort((a, b) => a.moduleOrder - b.moduleOrder || a.lessonOrder - b.lessonOrder);
      setCoursePhrases(phrases);

      // Pick the phrase: from ?lesson= if present, else first
      let idx = 0;
      if (lessonIdParam) {
        const found = phrases.findIndex((p) => p.lessonId === lessonIdParam);
        if (found >= 0) idx = found;
      }
      setSelectedPhraseIndex(idx);
      setPracticeText(phrases[idx]?.text ?? "");
      setPromptsLoading(false);
    };
    loadPhrases();
  }, [activeCourseId, lessonIdParam]);

  const handleSelectPhrase = (indexStr: string) => {
    const idx = parseInt(indexStr, 10);
    if (Number.isNaN(idx) || !coursePhrases[idx]) return;
    setSelectedPhraseIndex(idx);
    setPracticeText(coursePhrases[idx].text);
    setFeedback(null);
    setTranscription(null);
    setSuggestions([]);
  };

  const handleCourseChange = (courseId: string) => {
    setActiveCourseId(courseId);
    setLessonContext(null);
    setFeedback(null);
    setTranscription(null);
    setSuggestions([]);
  };

  const activeCourseTitle = useMemo(
    () => courses.find((c) => c.id === activeCourseId)?.title ?? "",
    [courses, activeCourseId],
  );

  const { isRecording, elapsed, recordings, startRecording, stopRecording, audioLevel } =
    useAudioRecorder();

  const analyzeWithAzure = useCallback(async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    setFeedback(null);
    setTranscription(null);
    setSuggestions([]);

    try {
      const formData = new FormData();
      const fileName = audioBlob.type.includes("wav") ? "recording.wav" : "recording.webm";
      const referenceTextOnScreen = mode === "scripted" ? practiceText : "";

      formData.append("audio", audioBlob, fileName);
      if (referenceTextOnScreen) {
        formData.append("referenceText", referenceTextOnScreen);
      }
      formData.append("language", "en-US");

      const { data, error } = await supabase.functions.invoke("azure-pronunciation", { body: formData });
      if (error) throw error;

      if (data?.error || data?.fallback) {
        setFeedback(null);
        setTranscription(null);
        window.alert(data.message || data.error || "Não foi possível obter as notas do Azure.");
        return;
      }

      const normalized = normalizeAzureResponse(data);

      const mappedFeedback: FeedbackScores = {
        // Map per Azure NBest[0].PronunciationAssessment fields
        pronunciation: normalized.accuracy,   // Círculo Pronúncia ← AccuracyScore
        fluency: normalized.fluency,           // Círculo Fluência ← FluencyScore
        grammar: normalized.completeness,      // (legacy) ← CompletenessScore
        vocabulary: normalized.prosody,        // (legacy) ← ProsodyScore
        completeness: normalized.completeness, // Círculo Completude
        prosody: normalized.prosody,           // Círculo Prosódia
        pronScore: normalized.pronunciation,   // Nota Geral ← PronunciationScore
        status: normalized.status,
        transcription: normalized.transcription,
        confidence: normalized.confidence,
        snr: normalized.snr,
      };

      setFeedback(mappedFeedback);
      setTranscription(normalized.transcription || null);

      if (user) {
        await supabase.from("voice_sessions").insert({
          user_id: user.id, mode,
          text_analyzed: normalized.transcription || null,
          accuracy_score: normalized.accuracy,
          fluency_score: normalized.fluency,
          prosody_score: normalized.prosody,
          grammar_feedback: `Completeness: ${normalized.completeness}%`,
        });
      }

      // Generate AI-powered specific feedback
      try {
        const { data: feedbackData } = await supabase.functions.invoke("pronunciation-feedback", {
          body: {
            scores: {
              pronunciation: mappedFeedback.pronunciation,
              fluency: mappedFeedback.fluency,
              grammar: mappedFeedback.grammar,
              vocabulary: mappedFeedback.vocabulary,
            },
            transcription: normalized.transcription || "",
            referenceText: referenceTextOnScreen,
            mode,
          },
        });
        if (feedbackData?.suggestions?.length) {
          setSuggestions(feedbackData.suggestions);
        } else {
          setSuggestions(["Não foi possível gerar feedback detalhado. Tente novamente."]);
        }
      } catch {
        setSuggestions(["Erro ao gerar sugestões. Tente gravar novamente."]);
      }
    } catch (err) {
      console.error("Azure analysis error:", err);
      window.alert("Erro ao analisar a pronúncia com o Azure. Verifique a integração e tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode, practiceText, user]);

  const handleStop = () => { stopRecording(); };

  useEffect(() => {
    const latestRecording = recordings[0];

    if (!latestRecording || latestRecording.id === analyzedId || isAnalyzing || isRecording) {
      return;
    }

    setAnalyzedId(latestRecording.id);
    void analyzeWithAzure(latestRecording.blob);
  }, [analyzeWithAzure, analyzedId, isAnalyzing, isRecording, recordings]);

  const handleReset = () => {
    setFeedback(null);
    setTranscription(null);
    setSuggestions([]);
    if (mode === "unscripted") {
      setCurrentTopic(pickRandom(unscriptedTopics));
    }
  };

  // (Texto vem da Lição via Admin — sem aleatoriedade nem upload de arquivos)

  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Laboratório de Pronúncia Transversal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pratique sua pronúncia e receba feedback detalhado com IA.
          <Badge variant="outline" className="ml-2">Nível {userLevel}</Badge>
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as "scripted" | "unscripted"); handleReset(); }}>
        <TabsList>
          <TabsTrigger value="scripted">📖 Scripted</TabsTrigger>
          <TabsTrigger value="unscripted">🎤 Unscripted</TabsTrigger>
        </TabsList>

        <TabsContent value="scripted" className="space-y-6">
          {promptsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Lesson context banner */}
              {lessonContext && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">Praticando a lição:</span>
                      <span className="font-medium text-foreground">{lessonContext.title}</span>
                      {lessonContext.courseTitle && (
                        <Badge variant="outline" className="text-[10px]">{lessonContext.courseTitle}</Badge>
                      )}
                    </div>
                    {lessonContext.courseId && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/courses/${lessonContext.courseId}`)} className="text-xs">
                        Voltar à lição
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Practice text */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Leia o texto abaixo em voz alta:</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg leading-relaxed text-foreground font-medium whitespace-pre-wrap">
                    {practiceText}
                  </p>
                </CardContent>
              </Card>

              <RecordButton isRecording={isRecording} isAnalyzing={isAnalyzing} elapsed={elapsed} onStart={startRecording} onStop={handleStop} audioLevel={audioLevel} />

              {recordings.length > 0 && (
                <div className="rounded-lg border p-3">
                  <audio src={recordings[0].url} controls className="w-full h-9" />
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="unscripted" className="space-y-6">
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="p-6 text-center">
              <p className="text-xs text-accent font-semibold uppercase tracking-wide mb-2">Tema Sugerido</p>
              <p className="text-lg font-medium text-foreground">{currentTopic}</p>
            </CardContent>
          </Card>

          <RecordButton isRecording={isRecording} isAnalyzing={isAnalyzing} elapsed={elapsed} onStart={startRecording} onStop={handleStop} freeLabel audioLevel={audioLevel} />

          {recordings.length > 0 && (
            <div className="rounded-lg border p-3">
              <audio src={recordings[0].url} controls className="w-full h-9" />
            </div>
          )}
        </TabsContent>
      </Tabs>


      <FeedbackCard scores={feedback} suggestions={suggestions.length > 0 ? suggestions : undefined} />

      {isAnalyzing && (
        <div className="flex flex-col items-center gap-2 py-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Analisando pronúncia…</p>
        </div>
      )}

      {feedback && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Nova Prática
          </Button>
        </div>
      )}
    </div>
  );
}

function RecordButton({ isRecording, isAnalyzing, elapsed, onStart, onStop, freeLabel, audioLevel }: {
  isRecording: boolean; isAnalyzing: boolean; elapsed: number; onStart: () => void; onStop: () => void; freeLabel?: boolean; audioLevel: number;
}) {
  const levelColor = audioLevel < 20 ? "bg-destructive" : audioLevel > 85 ? "bg-xp" : "bg-success";
  const levelLabel = audioLevel < 20 ? "Muito baixo" : audioLevel > 85 ? "Muito alto" : "Ideal";

  return (
    <div className="flex flex-col items-center gap-3">
      {isRecording ? (
        <>
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse-recording" />
            <Button size="lg" variant="destructive" className="relative h-20 w-20 rounded-full" onClick={onStop}>
              <Square className="h-7 w-7" />
            </Button>
          </div>
          <span className="text-sm font-mono text-destructive font-semibold">{formatTime(elapsed)}</span>
          <div className="w-48 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Volume do Microfone</span>
              <span className={audioLevel < 20 ? "text-destructive" : "text-success"}>{levelLabel}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-100 ${levelColor}`} style={{ width: `${audioLevel}%` }} />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{freeLabel ? "Fale livremente… clique para parar" : "Gravando… clique para parar"}</span>
        </>
      ) : (
        <>
          <Button size="lg" className="h-20 w-20 rounded-full" onClick={onStart} disabled={isAnalyzing}>
            {isAnalyzing ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-7 w-7" />}
          </Button>
          <span className="text-xs text-muted-foreground">{isAnalyzing ? "Analisando…" : "Clique para gravar"}</span>
        </>
      )}
    </div>
  );
}
