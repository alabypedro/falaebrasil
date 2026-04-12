import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, RotateCcw, Loader2 } from "lucide-react";
import FeedbackCard, { type FeedbackScores } from "@/components/FeedbackCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const scriptedPrompts = [
  {
    id: "1",
    level: "A2",
    text: "Hello! My name is Maria and I'm from Brazil. I love learning English because it helps me connect with people from all over the world.",
  },
  {
    id: "2",
    level: "B1",
    text: "Yesterday, I went to the supermarket to buy some groceries. I picked up fruits, vegetables, and a loaf of bread. The cashier was very friendly.",
  },
  {
    id: "3",
    level: "A1",
    text: "Good morning! How are you? I am fine, thank you. What is your name?",
  },
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

export default function VoiceLab() {
  const [mode, setMode] = useState<"scripted" | "unscripted">("scripted");
  const [selectedPrompt, setSelectedPrompt] = useState(scriptedPrompts[0]);
  const [currentTopic, setCurrentTopic] = useState(unscriptedTopics[0]);
  const [feedback, setFeedback] = useState<FeedbackScores | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { user } = useAuth();

  const { isRecording, elapsed, recordings, startRecording, stopRecording } =
    useAudioRecorder();

  const analyzeWithAzure = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    setFeedback(null);
    setTranscription(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      if (mode === "scripted") {
        formData.append("referenceText", selectedPrompt.text);
      }

      formData.append("language", "en-US");

      const { data, error } = await supabase.functions.invoke(
        "azure-pronunciation",
        { body: formData }
      );

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setFeedback({
        pronunciation: data.pronunciation,
        fluency: data.fluency,
        grammar: data.grammar,
        vocabulary: data.vocabulary,
      });

      setTranscription(data.transcription || null);

      // Save to voice_sessions table
      if (user) {
        await supabase.from("voice_sessions").insert({
          user_id: user.id,
          mode,
          text_analyzed: data.transcription || null,
          accuracy_score: data.pronunciation ?? null,
          fluency_score: data.fluency ?? null,
          prosody_score: data.vocabulary ?? null,
          grammar_feedback: data.grammar ? `Completeness: ${data.grammar}%` : null,
        });
      }

      // Generate suggestions based on scores
      const newSuggestions: string[] = [];
      if (data.pronunciation < 70)
        newSuggestions.push("Foque na articulação clara de cada palavra, especialmente sons como 'th', 'r' e 'l'.");
      if (data.fluency < 70)
        newSuggestions.push("Pratique a leitura em voz alta para melhorar o ritmo e a fluidez da fala.");
      if (data.grammar < 70)
        newSuggestions.push("Tente cobrir todas as palavras do texto de referência sem pular trechos.");
      if (data.vocabulary < 70)
        newSuggestions.push("Trabalhe a entonação e a prosódia para soar mais natural.");
      if (newSuggestions.length === 0)
        newSuggestions.push("Excelente! Continue praticando para manter seu nível alto.");

      setSuggestions(newSuggestions);
    } catch (err) {
      console.error("Azure analysis error:", err);
      toast.error("Erro ao analisar pronúncia. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStop = () => {
    stopRecording();
    setTimeout(() => {}, 500);
  };

  // Watch for new recordings and auto-analyze
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
      const next = unscriptedTopics[Math.floor(Math.random() * unscriptedTopics.length)];
      setCurrentTopic(next);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Laboratório de Pronúncia Transversal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pratique sua pronúncia e receba feedback detalhado com IA.
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as "scripted" | "unscripted"); handleReset(); }}>
        <TabsList>
          <TabsTrigger value="scripted">📖 Scripted</TabsTrigger>
          <TabsTrigger value="unscripted">🎤 Unscripted</TabsTrigger>
        </TabsList>

        <TabsContent value="scripted" className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {scriptedPrompts.map((p) => (
              <Button
                key={p.id}
                variant={selectedPrompt.id === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => { setSelectedPrompt(p); handleReset(); }}
              >
                <Badge variant="secondary" className="mr-1.5 text-[10px]">{p.level}</Badge>
                Texto {p.id}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Leia o texto abaixo em voz alta:</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed text-foreground font-medium">
                {selectedPrompt.text}
              </p>
            </CardContent>
          </Card>

          <RecordButton isRecording={isRecording} isAnalyzing={isAnalyzing} elapsed={elapsed} onStart={startRecording} onStop={handleStop} />

          {recordings.length > 0 && (
            <div className="rounded-lg border p-3">
              <audio src={recordings[0].url} controls className="w-full h-9" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="unscripted" className="space-y-6">
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="p-6 text-center">
              <p className="text-xs text-accent font-semibold uppercase tracking-wide mb-2">Tema Sugerido</p>
              <p className="text-lg font-medium text-foreground">{currentTopic}</p>
            </CardContent>
          </Card>

          <RecordButton isRecording={isRecording} isAnalyzing={isAnalyzing} elapsed={elapsed} onStart={startRecording} onStop={handleStop} freeLabel />

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
            <CardTitle className="text-sm text-muted-foreground">O que o Azure entendeu:</CardTitle>
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
          <p className="text-sm text-muted-foreground">Analisando pronúncia com Azure Speech…</p>
        </div>
      )}

      {feedback && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nova Prática
          </Button>
        </div>
      )}
    </div>
  );
}

function RecordButton({ isRecording, isAnalyzing, elapsed, onStart, onStop, freeLabel }: {
  isRecording: boolean; isAnalyzing: boolean; elapsed: number; onStart: () => void; onStop: () => void; freeLabel?: boolean;
}) {
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
