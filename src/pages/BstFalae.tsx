import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Loader2, ArrowLeft, Volume2 } from "lucide-react";
import FeedbackCard, { type FeedbackScores } from "@/components/FeedbackCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { toast } from "sonner";
import { awardAiXp } from "@/lib/aiXp";
import AiProgressPanel from "@/components/AiProgressPanel";

interface Script {
  id: string;
  title: string;
  script_text: string;
  level: string;
  display_order: number;
}

function num(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
}

export default function BstFalae({ bstProductId }: { bstProductId: string }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Script | null>(null);
  const [feedback, setFeedback] = useState<FeedbackScores | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedId, setAnalyzedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const { isRecording, elapsed, recordings, startRecording, stopRecording } = useAudioRecorder();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bst_voice_scripts")
        .select("id,title,script_text,level,display_order")
        .eq("bst_product_id", bstProductId)
        .order("display_order");
      setScripts((data as Script[]) || []);
      setLoading(false);
    })();
  }, [bstProductId]);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const analyze = useCallback(
    async (blob: Blob) => {
      if (!active) return;
      setIsAnalyzing(true);
      setFeedback(null);
      setSuggestions([]);
      try {
        const fd = new FormData();
        fd.append("audio", blob, blob.type.includes("wav") ? "recording.wav" : "recording.webm");
        fd.append("referenceText", active.script_text);
        fd.append("language", "en-US");
        fd.append("mode", "scripted");
        const { data, error } = await supabase.functions.invoke("azure-pronunciation", { body: fd });
        if (error) throw error;
        if (data?.error || data?.fallback) {
          toast.error(data.message || data.error || "Não foi possível analisar o áudio.");
          return;
        }
        const raw = data?.scores ?? {};
        const scores: FeedbackScores = {
          pronunciation: num(data?.accuracy ?? raw?.accuracy),
          fluency: num(data?.fluency ?? raw?.fluency),
          grammar: num(data?.completeness ?? raw?.completeness),
          vocabulary: num(data?.prosody ?? raw?.prosody),
          completeness: num(data?.completeness ?? raw?.completeness),
          prosody: num(data?.prosody ?? raw?.prosody),
          pronScore: num(data?.pronunciation ?? raw?.pronunciation),
          transcription: data?.transcription,
          words: data?.words || [],
        };
        setFeedback(scores);
        const overall = scores.pronScore || 0;
        if (overall > 0) {
          const xp = Math.round(overall / 4);
          await awardAiXp("falae", xp, `bst-falae:${active.id}:${crypto.randomUUID()}`);
          toast.success(`+${xp} XP`);
        }

        // Sugestões de melhoria geradas por IA (mesma lógica do IA Falaê normal)
        try {
          const { data: feedbackData } = await supabase.functions.invoke("pronunciation-feedback", {
            body: {
              scores: {
                pronunciation: scores.pronunciation,
                fluency: scores.fluency,
                grammar: scores.grammar,
                vocabulary: scores.vocabulary,
              },
              transcription: scores.transcription || "",
              referenceText: active.script_text,
              mode: "scripted",
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
      } catch (e: any) {
        toast.error(e.message || "Erro na análise.");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [active]
  );

  useEffect(() => {
    const latest = recordings[0];
    if (!latest || latest.id === analyzedId || isAnalyzing || isRecording) return;
    setAnalyzedId(latest.id);
    void analyze(latest.blob);
  }, [recordings, analyzedId, isAnalyzing, isRecording, analyze]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (active) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => { setActive(null); setFeedback(null); setSuggestions([]); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos scripts
        </Button>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{active.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg leading-relaxed font-display">{active.script_text}</p>
            <Button variant="outline" size="sm" onClick={() => speak(active.script_text)}>
              <Volume2 className="h-4 w-4 mr-1" /> Ouvir modelo
            </Button>
            <div className="flex flex-col items-center gap-2 pt-2">
              {!isRecording ? (
                <Button size="lg" onClick={startRecording} disabled={isAnalyzing}>
                  <Mic className="h-4 w-4 mr-2" /> Gravar minha leitura
                </Button>
              ) : (
                <Button size="lg" variant="destructive" onClick={stopRecording}>
                  <Square className="h-4 w-4 mr-2" /> Parar ({elapsed}s)
                </Button>
              )}
              {recordings.length > 0 && (
                <audio src={recordings[0].url} controls className="w-full h-9" />
              )}
            </div>
          </CardContent>
        </Card>
        {isAnalyzing && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando pronúncia…</p>
          </div>
        )}
        <FeedbackCard
          scores={feedback}
          suggestions={suggestions.length > 0 ? suggestions : undefined}
          toolLabel="IA Falaê BST"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">IA Falaê BST (scripted)</h2>
        <p className="text-sm text-muted-foreground">
          Leia em voz alta os scripts deste produto e receba notas de pronúncia, fluência e prosódia.
        </p>
      </div>
      <AiProgressPanel
        title="Progresso da IA Falaê BST"
        subtitle="Scripts deste produto praticados com avaliação de pronúncia."
        source="falae"
        xpKeyPrefixes={["bst-falae:"]}
        total={scripts.length}
        completedLabel="scripts estimados"
        totalLabel="scripts"
        icon={Mic}
        stats={[
          { label: "scripts disponíveis", value: scripts.length },
          { label: "níveis no produto", value: new Set(scripts.map((script) => script.level)).size || "—" },
        ]}
      />
      {scripts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum script disponível neste produto ainda.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActive(s); setFeedback(null); setSuggestions([]); }}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary hover:bg-muted/40 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">{s.script_text.slice(0, 110)}…</div>
              </div>
              <Badge variant="outline" className="shrink-0">{s.level}</Badge>
              <Mic className="h-4 w-4 text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
