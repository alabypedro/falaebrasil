import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, Square, RotateCcw, Loader2, Shuffle, Upload, FileText } from "lucide-react";
import FeedbackCard, { type FeedbackScores } from "@/components/FeedbackCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type NormalizedAzureResponse = {
  status?: string;
  transcription?: string;
  confidence?: number;
  snr?: number | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  prosodyScore: number | null;
  completenessScore: number | null;
  pronunciationScore: number | null;
  missingScores: string[];
};

function toNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function tryParseAzureJson(value: unknown): Record<string, any> | null {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeAzureResponse(payload: any): NormalizedAzureResponse {
  const propertyPayload =
    tryParseAzureJson(payload?.properties?.SpeechServiceResponse_JsonResult) ??
    tryParseAzureJson(payload?.speechServiceResponseJsonResult) ??
    tryParseAzureJson(payload?.jsonResult) ??
    null;

  const candidate = propertyPayload ?? payload?.result ?? payload;
  const best = candidate?.NBest?.[0] ?? payload?.NBest?.[0] ?? null;
  const pronunciationAssessment =
    best?.PronunciationAssessment ??
    candidate?.PronunciationAssessment ??
    payload?.PronunciationAssessment ??
    null;

  const accuracyScore = toNullableNumber(
    payload?.accuracyScore ?? payload?.AccuracyScore ?? payload?.pronunciation ?? pronunciationAssessment?.AccuracyScore,
  );
  const fluencyScore = toNullableNumber(
    payload?.fluencyScore ?? payload?.FluencyScore ?? payload?.fluency ?? pronunciationAssessment?.FluencyScore,
  );
  const prosodyScore = toNullableNumber(
    payload?.prosodyScore ??
      payload?.ProsodyScore ??
      payload?.prosody ??
      payload?.vocabulary ??
      pronunciationAssessment?.ProsodyScore,
  );
  const completenessScore = toNullableNumber(
    payload?.completenessScore ??
      payload?.CompletenessScore ??
      payload?.completeness ??
      payload?.grammar ??
      pronunciationAssessment?.CompletenessScore,
  );
  const pronunciationScore = toNullableNumber(
    payload?.pronunciationScore ??
      payload?.PronunciationScore ??
      payload?.pronScore ??
      payload?.PronScore ??
      pronunciationAssessment?.PronunciationScore ??
      pronunciationAssessment?.PronScore,
  );

  const rawConfidence = toNullableNumber(payload?.confidence ?? payload?.Confidence ?? best?.Confidence);
  const confidence =
    rawConfidence == null ? undefined : rawConfidence <= 1 ? Math.round(rawConfidence * 100) : rawConfidence;

  const missingScores = [
    accuracyScore == null ? "AccuracyScore" : null,
    fluencyScore == null ? "FluencyScore" : null,
    prosodyScore == null ? "ProsodyScore" : null,
    completenessScore == null ? "CompletenessScore" : null,
    pronunciationScore == null ? "PronunciationScore" : null,
  ].filter((score): score is string => Boolean(score));

  return {
    status: payload?.status ?? payload?.RecognitionStatus ?? candidate?.RecognitionStatus,
    transcription:
      payload?.transcription ??
      best?.Display ??
      best?.Lexical ??
      candidate?.DisplayText ??
      undefined,
    confidence,
    snr: toNullableNumber(payload?.snr ?? payload?.SNR ?? candidate?.SNR),
    accuracyScore,
    fluencyScore,
    prosodyScore,
    completenessScore,
    pronunciationScore,
    missingScores,
  };
}

const fallbackPrompts = [
  { id: "f1", level: "A1", text: "Good morning! How are you? I am fine, thank you. What is your name?" },
  { id: "f2", level: "A2", text: "Hello! My name is Maria and I'm from Brazil. I love learning English because it helps me connect with people from all over the world." },
  { id: "f3", level: "B1", text: "Yesterday, I went to the supermarket to buy some groceries. I picked up fruits, vegetables, and a loaf of bread. The cashier was very friendly." },
];

const genericPhrases = [
  { id: "g1", text: "The weather today is beautiful, and I would like to take a walk in the park." },
  { id: "g2", text: "Can you please tell me where the nearest bus stop is? I need to get to the city center." },
  { id: "g3", text: "I enjoy reading books in my free time, especially adventure and science fiction novels." },
  { id: "g4", text: "Excuse me, could you help me find the way to the library? I'm new in this neighborhood." },
  { id: "g5", text: "My favorite food is pasta with tomato sauce. I usually cook it on weekends for my family." },
  { id: "g6", text: "Technology has changed the way we communicate with each other in many interesting ways." },
  { id: "g7", text: "I would like to order a cup of coffee and a piece of chocolate cake, please." },
  { id: "g8", text: "Learning a new language takes time and patience, but the results are truly rewarding." },
  { id: "g9", text: "The children are playing in the garden while their parents are preparing dinner inside." },
  { id: "g10", text: "Could you recommend a good restaurant near here? I'm looking for Italian food." },
];

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

export default function VoiceLab() {
  const [mode, setMode] = useState<"scripted" | "unscripted">("scripted");
  const [prompts, setPrompts] = useState<{ id: string; level: string; text: string }[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<{ id: string; level: string; text: string } | null>(null);
  const [currentTopic, setCurrentTopic] = useState(unscriptedTopics[0]);
  const [feedback, setFeedback] = useState<FeedbackScores | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [analyzedId, setAnalyzedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, profile } = useAuth();

  const userLevel = profile?.level || "A1";

  // Fetch prompts from DB filtered by user level
  useEffect(() => {
    const fetchPrompts = async () => {
      setPromptsLoading(true);
      const { data } = await supabase
        .from("pronunciation_prompts")
        .select("id, text, level")
        .eq("level", userLevel);

      if (data && data.length > 0) {
        setPrompts(data);
        setSelectedPrompt(pickRandom(data));
      } else {
        const matching = fallbackPrompts.filter((p) => p.level === userLevel);
        const available = matching.length > 0 ? matching : fallbackPrompts;
        setPrompts(available);
        setSelectedPrompt(pickRandom(available));
      }
      setPromptsLoading(false);
    };
    fetchPrompts();
  }, [userLevel]);

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
      const referenceTextOnScreen = mode === "scripted" ? selectedPrompt?.text ?? "" : "";

      formData.append("audio", audioBlob, fileName);
      if (referenceTextOnScreen) {
        formData.append("referenceText", referenceTextOnScreen);
      }
      formData.append("language", "en-US");

      const { data, error } = await supabase.functions.invoke("azure-pronunciation", { body: formData });
      if (error) throw error;

      const normalized = normalizeAzureResponse(data);

      if (data.error || data.fallback) {
        setFeedback(null);
        setTranscription(normalized.transcription ?? null);
        window.alert(data.message || data.error || "Não foi possível obter as notas do Azure.");
        return;
      }

      if (normalized.missingScores.length > 0) {
        setFeedback(null);
        setTranscription(normalized.transcription ?? null);
        window.alert(
          `O Azure reconheceu o áudio, mas não retornou todas as notas esperadas: ${normalized.missingScores.join(", ")}.`,
        );
        return;
      }

      const accuracyScore = normalized.accuracyScore as number;
      const fluencyScore = normalized.fluencyScore as number;
      const completenessScore = normalized.completenessScore as number;
      const prosodyScore = normalized.prosodyScore as number;
      const pronunciationScore = normalized.pronunciationScore as number;

      const mappedFeedback: FeedbackScores = {
        pronunciation: accuracyScore,
        fluency: fluencyScore,
        grammar: completenessScore,
        vocabulary: prosodyScore,
        status: normalized.status,
        transcription: normalized.transcription,
        confidence: normalized.confidence,
        snr: normalized.snr,
        completeness: completenessScore,
        prosody: prosodyScore,
        pronScore: pronunciationScore,
      };

      setFeedback(mappedFeedback);
      setTranscription(normalized.transcription || null);

      if (user) {
        await supabase.from("voice_sessions").insert({
          user_id: user.id, mode,
          text_analyzed: normalized.transcription || null,
          accuracy_score: accuracyScore,
          fluency_score: fluencyScore,
          prosody_score: prosodyScore,
          grammar_feedback: `Completeness: ${completenessScore}%`,
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
  }, [mode, selectedPrompt, user]);

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

  // Shuffle from DB/imported prompts
  const shufflePrompt = () => {
    if (prompts.length <= 1) return;
    let next = pickRandom(prompts);
    while (next.id === selectedPrompt?.id && prompts.length > 1) next = pickRandom(prompts);
    setSelectedPrompt(next);
    handleReset();
  };

  // Shuffle generic phrase (unrelated to imported content)
  const shuffleGeneric = () => {
    const generic = pickRandom(genericPhrases);
    setSelectedPrompt({ id: generic.id, level: userLevel, text: generic.text });
    handleReset();
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".txt", ".csv", ".md", ".pdf"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExts.includes(ext)) {
      toast.error("Formato não suportado. Use .txt, .csv, .md ou .pdf");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("level", userLevel);

      const { data, error } = await supabase.functions.invoke("parse-prompts", { body: formData });
      if (error) throw error;

      const parsed = data.prompts as { text: string; level: string }[];
      if (!parsed?.length) {
        toast.warning("Nenhum texto válido encontrado no arquivo.");
        return;
      }

      // Insert into DB
      const rows = parsed.map((p) => ({ text: p.text, level: p.level, source_file: file.name }));
      const { error: insertErr } = await supabase.from("pronunciation_prompts").insert(rows);
      if (insertErr) throw insertErr;

      toast.success(`${rows.length} texto(s) importado(s) com sucesso!`);
      setUploadedFileName(file.name);

      // Reload prompts
      const { data: freshData } = await supabase
        .from("pronunciation_prompts")
        .select("id, text, level")
        .eq("level", userLevel);

      if (freshData && freshData.length > 0) {
        setPrompts(freshData);
        setSelectedPrompt(pickRandom(freshData));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar arquivo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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
              {/* File import section */}
              <Card className="border-dashed border-2 border-muted-foreground/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                      <Upload className="h-4 w-4" />
                      <span>Importar textos:</span>
                    </div>
                    <div className="flex-1 w-full sm:w-auto">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.csv,.md,.pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="cursor-pointer file:cursor-pointer file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                      />
                    </div>
                    {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />}
                    {uploadedFileName && !uploading && (
                      <Badge variant="secondary" className="flex-shrink-0 gap-1">
                        <FileText className="h-3 w-3" />
                        {uploadedFileName}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-2 text-center sm:text-left">
                    Formatos aceitos: .txt, .csv, .md, .pdf — Os textos serão adicionados ao seu nível atual.
                  </p>
                </CardContent>
              </Card>

              {/* Prompt display */}
              <Card>
                <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm text-muted-foreground">Leia o texto abaixo em voz alta:</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={shufflePrompt}
                      disabled={prompts.length <= 1}
                      className="gap-1 text-xs"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Sortear importado
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={shuffleGeneric}
                      className="gap-1 text-xs"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Sortear genérico
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-lg leading-relaxed text-foreground font-medium">
                    {selectedPrompt?.text}
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
