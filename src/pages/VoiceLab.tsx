import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, RotateCcw, Loader2, Shuffle } from "lucide-react";
import FeedbackCard, { type FeedbackScores } from "@/components/FeedbackCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const fallbackPrompts = [
  { id: "f1", level: "A1", text: "Good morning! How are you? I am fine, thank you. What is your name?" },
  { id: "f2", level: "A2", text: "Hello! My name is Maria and I'm from Brazil. I love learning English because it helps me connect with people from all over the world." },
  { id: "f3", level: "B1", text: "Yesterday, I went to the supermarket to buy some groceries. I picked up fruits, vegetables, and a loaf of bread. The cashier was very friendly." },
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
        // Fallback: filter hardcoded by level or show all
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

  const analyzeWithAzure = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    setFeedback(null);
    setTranscription(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      if (mode === "scripted" && selectedPrompt) {
        formData.append("referenceText", selectedPrompt.text);
      }
      formData.append("language", "en-US");

      const { data, error } = await supabase.functions.invoke("azure-pronunciation", { body: formData });
      if (error) throw error;

      if (data.error || data.fallback) {
        toast.error(data.message || data.error || "Não foi possível reconhecer o áudio. Fale mais alto e claro.");
        return;
      }

      setFeedback({
        pronunciation: data.pronunciation,
        fluency: data.fluency,
        grammar: data.grammar,
        vocabulary: data.vocabulary,
      });
      setTranscription(data.transcription || null);

      if (user) {
        await supabase.from("voice_sessions").insert({
          user_id: user.id, mode,
          text_analyzed: data.transcription || null,
          accuracy_score: data.pronunciation ?? null,
          fluency_score: data.fluency ?? null,
          prosody_score: data.vocabulary ?? null,
          grammar_feedback: data.grammar ? `Completeness: ${data.grammar}%` : null,
        });
      }

      const newSuggestions: string[] = [];
      if (data.pronunciation < 70) newSuggestions.push("Foque na articulação clara de cada palavra, especialmente sons como 'th', 'r' e 'l'.");
      if (data.fluency < 70) newSuggestions.push("Pratique a leitura em voz alta para melhorar o ritmo e a fluidez da fala.");
      if (data.grammar < 70) newSuggestions.push("Tente cobrir todas as palavras do texto de referência sem pular trechos.");
      if (data.vocabulary < 70) newSuggestions.push("Trabalhe a entonação e a prosódia para soar mais natural.");
      if (newSuggestions.length === 0) newSuggestions.push("Excelente! Continue praticando para manter seu nível alto.");
      setSuggestions(newSuggestions);
    } catch (err) {
      console.error("Azure analysis error:", err);
      toast.error("Erro ao analisar pronúncia. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStop = () => { stopRecording(); };

  const lastRecordingId = recordings[0]?.id;
  const [analyzedId, setAnalyzedId] = useState<string | null>(null);
  if (lastRecordingId && lastRecordingId !== analyzedId && !isAnalyzing && !isRecording) {
    setAnalyzedId(lastRecordingId);
    analyzeWithAzure(recordings[0].blob);
  }

  const handleReset = () => {
    setFeedback(null);
    setTranscription(null);
    setSuggestions([]);
    setAnalyzedId(null);
    if (mode === "unscripted") {
      setCurrentTopic(pickRandom(unscriptedTopics));
    }
  };

  const shufflePrompt = () => {
    if (prompts.length <= 1) return;
    let next = pickRandom(prompts);
    while (next.id === selectedPrompt?.id && prompts.length > 1) next = pickRandom(prompts);
    setSelectedPrompt(next);
    handleReset();
  };

  return (
    <div className="space-y-6 max-w-4xl">
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
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">Leia o texto abaixo em voz alta:</CardTitle>
                  <Button variant="ghost" size="sm" onClick={shufflePrompt} disabled={prompts.length <= 1}>
                    <Shuffle className="h-4 w-4 mr-1" /> Sortear outro
                  </Button>
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

      {transcription && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">O que foi entendido:</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-foreground">{transcription}</p>
          </CardContent>
        </Card>
      )}

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
  const levelColor = audioLevel < 20 ? "bg-destructive" : audioLevel < 50 ? "bg-xp" : "bg-success";
  const levelLabel = audioLevel < 20 ? "Muito baixo" : audioLevel < 50 ? "Bom" : "Ótimo";

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
