import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Square, RotateCcw, Loader2, BookOpen, Sparkles } from "lucide-react";
import FeedbackCard, { type FeedbackScores } from "@/components/FeedbackCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";

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
  missingScoreFields: string[];
};

function toNumberOrZero(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function normalizeAzureResponse(payload: any): NormalizedAzureResponse {
  console.log("Edge function payload received:", payload);

  const missingScoreFields = Array.isArray(payload?.missingScoreFields)
    ? payload.missingScoreFields.filter((field: unknown): field is string => typeof field === "string")
    : [];

  const rawScores = payload?.scores ?? payload?.result?.scores ?? payload?.PronunciationAssessmentResult ?? {};

  return {
    status: payload?.status,
    transcription: payload?.transcription ?? undefined,
    confidence: typeof payload?.confidence === "number" ? payload.confidence : undefined,
    snr: typeof payload?.snr === "number" ? payload.snr : null,
    accuracy: toNumberOrZero(payload?.accuracy ?? rawScores?.accuracy ?? rawScores?.AccuracyScore),
    fluency: toNumberOrZero(payload?.fluency ?? rawScores?.fluency ?? rawScores?.FluencyScore),
    completeness: toNumberOrZero(payload?.completeness ?? rawScores?.completeness ?? rawScores?.CompletenessScore),
    prosody: toNumberOrZero(payload?.prosody ?? rawScores?.prosody ?? rawScores?.ProsodyScore),
    pronunciation: toNumberOrZero(
      payload?.pronunciation
      ?? rawScores?.pronunciation
      ?? rawScores?.PronunciationScore
      ?? rawScores?.PronScore,
    ),
    missingScoreFields,
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
  const [recentTopics, setRecentTopics] = useState<string[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
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

  const { user, profile, refreshProfile } = useAuth();
  const userLevel = profile?.level || "A1";

  const scriptedBalance = profile?.scripted_balance ?? 0;
  const unscriptedBalance = profile?.unscripted_balance ?? 0;
  const scriptedExhausted = scriptedBalance <= 0;
  const unscriptedExhausted = unscriptedBalance <= 0;

  // Load all published courses for the selector
  useEffect(() => {
    const loadCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, level, published, display_order")
        .order("display_order");
      const desiredOrder = ["A1","A2","B1","B2","T1","T2","T3","T4","K1","K2","K3","K4"];
      const extractCode = (title: string, level?: string | null) => {
        const fromLevel = (level || "").toUpperCase();
        if (desiredOrder.includes(fromLevel)) return fromLevel;
        const m = title.match(/\b([ATK][1-4]|A1|A2|B1|B2)\b/i);
        return m ? m[1].toUpperCase() : "";
      };
      const list = ((data as any[]) || [])
        .filter((c) => c.published)
        .map((c) => ({ id: c.id, title: c.title, _code: extractCode(c.title, c.level) }))
        .sort((a, b) => {
          const ai = desiredOrder.indexOf(a._code);
          const bi = desiredOrder.indexOf(b._code);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        })
        .map(({ id, title }) => ({ id, title }));
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
    if (activeCourseId || lessonIdParam || courses.length === 0) return;
    const pickDefault = async () => {
      // Try the course the student is currently progressing on (most recent video completion)
      if (user) {
        const { data: progress } = await supabase
          .from("user_video_progress")
          .select("video_id, completed_at")
          .eq("user_id", user.id)
          .order("completed_at", { ascending: false })
          .limit(20);
        const videoIds = (progress || []).map((p: any) => p.video_id);
        if (videoIds.length > 0) {
          const { data: videos } = await supabase
            .from("lesson_videos")
            .select("id, lesson_id")
            .in("id", videoIds);
          const lessonIds = Array.from(new Set((videos || []).map((v: any) => v.lesson_id)));
          if (lessonIds.length > 0) {
            const { data: lessons } = await supabase
              .from("lessons")
              .select("id, module_id")
              .in("id", lessonIds);
            const moduleIds = Array.from(new Set((lessons || []).map((l: any) => l.module_id)));
            if (moduleIds.length > 0) {
              const { data: mods } = await supabase
                .from("modules")
                .select("id, course_id")
                .in("id", moduleIds);
              const videoToCourse: Record<string, string> = {};
              const lessonToCourse: Record<string, string> = {};
              const moduleToCourse: Record<string, string> = {};
              (mods || []).forEach((m: any) => { moduleToCourse[m.id] = m.course_id; });
              (lessons || []).forEach((l: any) => { const cid = moduleToCourse[l.module_id]; if (cid) lessonToCourse[l.id] = cid; });
              (videos || []).forEach((v: any) => { const cid = lessonToCourse[v.lesson_id]; if (cid) videoToCourse[v.id] = cid; });
              const courseIds = new Set(courses.map((c) => c.id));
              for (const p of progress || []) {
                const cid = videoToCourse[(p as any).video_id];
                if (cid && courseIds.has(cid)) {
                  setActiveCourseId(cid);
                  return;
                }
              }
            }
          }
        }
      }
      // Fallback: first in the sorted list (A1 when available)
      setActiveCourseId(courses[0].id);
    };
    pickDefault();
  }, [courses, activeCourseId, lessonIdParam, user]);

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
      formData.append("mode", mode);

      const { data, error } = await supabase.functions.invoke("azure-pronunciation", { body: formData });
      if (error) throw error;

      if (data?.error || data?.fallback) {
        setFeedback(null);
        setTranscription(null);
        window.alert(data.message || data.error || "Não foi possível obter as notas do Azure.");
        // Refresh balance even on fallback (in case credits were debited or check failed)
        void refreshProfile();
        return;
      }

      const normalized = normalizeAzureResponse(data);

      if (normalized.missingScoreFields.length > 0) {
        window.alert(
          `O Azure respondeu sem algumas notas: ${normalized.missingScoreFields.join(", ")}. Verifique a integração.`,
        );
      }

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

      // Update balance after successful analysis
      void refreshProfile();

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
  }, [mode, practiceText, user, refreshProfile]);

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
      void fetchUnscriptedTopic();
    }
  };

  const fetchUnscriptedTopic = useCallback(async () => {
    setTopicLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-unscripted-topic", {
        body: { recent: recentTopics.slice(0, 6) },
      });
      if (error) throw error;
      const topic = (data as any)?.topic as string | undefined;
      if (topic) {
        setCurrentTopic(topic);
        setRecentTopics((prev) => [topic, ...prev.filter((t) => t !== topic)].slice(0, 8));
      } else {
        setCurrentTopic(pickRandom(unscriptedTopics));
      }
    } catch (e) {
      console.error("Failed to fetch AI topic", e);
      setCurrentTopic(pickRandom(unscriptedTopics));
    } finally {
      setTopicLoading(false);
    }
  }, [recentTopics]);

  // Auto-fetch a fresh AI topic the first time the user enters Unscripted
  useEffect(() => {
    if (mode === "unscripted" && recentTopics.length === 0 && !topicLoading) {
      void fetchUnscriptedTopic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // (Texto vem da Lição via Admin — sem aleatoriedade nem upload de arquivos)

  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <div>
        <h1 className="text-2xl font-bold text-foreground">IA Falaê</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pratique sua pronúncia e receba feedback detalhado com IA.
        </p>
      </div>

      {/* AI Consumption panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Consumo de IA</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <BalanceMeter
            label="Scripted (leitura/repetição)"
            seconds={scriptedBalance}
          />
          <BalanceMeter
            label="Unscripted (conversação livre)"
            seconds={unscriptedBalance}
          />
        </CardContent>
      </Card>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as "scripted" | "unscripted"); handleReset(); }}>
        <TabsList>
          <TabsTrigger value="scripted">📖 Scripted</TabsTrigger>
          <TabsTrigger value="unscripted">🎤 Unscripted</TabsTrigger>
        </TabsList>

        <TabsContent value="scripted" className="space-y-6">
          {scriptedExhausted && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-destructive font-medium">
                  Saldo de Scripted esgotado. Adquira novos módulos para continuar praticando.
                </span>
              </CardContent>
            </Card>
          )}

          {/* Course selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Curso ativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Select value={activeCourseId} onValueChange={handleCourseChange}>
                <SelectTrigger className="w-full sm:w-96">
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 && <SelectItem value="none" disabled>Nenhum curso disponível</SelectItem>}
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                As frases abaixo são apenas do curso selecionado.
              </p>
            </CardContent>
          </Card>

          {promptsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Lesson context banner (when entered from a lesson) */}
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

              {coursePhrases.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    {activeCourseTitle ? (
                      <>O curso <strong>{activeCourseTitle}</strong> ainda não tem frases para o IA Falaê.</>
                    ) : (
                      <>Selecione um curso acima para ver as frases disponíveis.</>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Phrases list (no lesson labels) */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Escolha uma frase {activeCourseTitle && <span className="text-foreground font-medium">— {activeCourseTitle}</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                        {coursePhrases.map((p, idx) => {
                          const active = idx === selectedPhraseIndex;
                          return (
                            <button
                              key={`${p.lessonId}-${idx}`}
                              type="button"
                              onClick={() => handleSelectPhrase(String(idx))}
                              className={cn(
                                "w-full text-left rounded-md border px-3 py-2 text-sm transition-colors",
                                active
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                                {idx + 1}
                              </span>
                              <span className="line-clamp-2 align-middle">{p.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Selected phrase to read aloud */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Leia em voz alta:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg leading-relaxed text-foreground font-medium whitespace-pre-wrap">
                        {practiceText}
                      </p>
                    </CardContent>
                  </Card>

                  <RecordButton isRecording={isRecording} isAnalyzing={isAnalyzing} elapsed={elapsed} onStart={startRecording} onStop={handleStop} audioLevel={audioLevel} disabled={scriptedExhausted} />

                  {recordings.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <audio src={recordings[0].url} controls className="w-full h-9" />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="unscripted" className="space-y-6">
          {unscriptedExhausted && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-destructive font-medium">
                  Saldo de Unscripted esgotado. Adquira novos módulos para continuar praticando.
                </span>
              </CardContent>
            </Card>
          )}

          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-xs text-accent font-semibold uppercase tracking-wide">Tema Sugerido</p>
              {topicLoading ? (
                <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Gerando tema com IA…</span>
                </div>
              ) : (
                <p className="text-lg font-medium text-foreground">{currentTopic}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchUnscriptedTopic()}
                disabled={topicLoading}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Novo tema
              </Button>
            </CardContent>
          </Card>

          <RecordButton isRecording={isRecording} isAnalyzing={isAnalyzing} elapsed={elapsed} onStart={startRecording} onStop={handleStop} freeLabel audioLevel={audioLevel} disabled={unscriptedExhausted} />

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

function RecordButton({ isRecording, isAnalyzing, elapsed, onStart, onStop, freeLabel, audioLevel, disabled }: {
  isRecording: boolean; isAnalyzing: boolean; elapsed: number; onStart: () => void; onStop: () => void; freeLabel?: boolean; audioLevel: number; disabled?: boolean;
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
          <Button size="lg" className="h-20 w-20 rounded-full" onClick={onStart} disabled={isAnalyzing || disabled}>
            {isAnalyzing ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-7 w-7" />}
          </Button>
          <span className="text-xs text-muted-foreground">{disabled ? "Saldo esgotado" : isAnalyzing ? "Analisando…" : "Clique para gravar"}</span>
        </>
      )}
    </div>
  );
}

function BalanceMeter({ label, seconds }: { label: string; seconds: number }) {
  const exhausted = seconds <= 0;
  // Cap progress display at 900s (1 product = 900s total but split). Use 600s scripted / 300s unscripted as visual reference; just normalize to a 0–600 window per meter for color cue.
  const ref = label.toLowerCase().includes("scripted") ? 600 : 300;
  const pct = Math.min(100, Math.round((seconds / ref) * 100));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono font-semibold", exhausted ? "text-destructive" : "text-foreground")}>
          {mins}m {secs.toString().padStart(2, "0")}s
        </span>
      </div>
      <Progress value={exhausted ? 0 : pct} className={cn("h-2", exhausted && "[&>div]:bg-destructive")} />
    </div>
  );
}
