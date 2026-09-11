import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Music, Lightbulb, CheckCircle2, XCircle, Trophy, RotateCcw } from "lucide-react";

export interface ListenBlank {
  id: string;
  line_index: number;
  text_before: string;
  answer: string;
  text_after: string;
  hint: string | null;
}

/** Som sutil de acerto/erro via WebAudio (sem arquivos externos). */
function playTone(kind: "ok" | "bad") {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime;
    if (kind === "ok") {
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(990, t + 0.09);
    } else {
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.setValueAtTime(180, t + 0.1);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.start(t);
    osc.stop(t + 0.28);
    osc.onended = () => ctx.close();
  } catch {
    /* silencioso */
  }
}

const FALLBACK_DISTRACTORS = [
  "you", "me", "my", "we", "love", "time", "night", "heart", "away", "again",
  "know", "feel", "come", "back", "never", "always", "home", "eyes", "hand", "life",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Modo Escuta: escolha múltipla lacuna por lacuna, sincronizado com o vídeo. */
export default function ListenMode({
  blanks,
  onComplete,
}: {
  blanks: ListenBlank[];
  onComplete?: (score: number, correct: number, total: number) => void;
}) {
  const total = blanks.length;
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const notified = useRef(false);

  const optionsByBlank = useMemo(() => {
    const map: Record<string, string[]> = {};
    const pool = blanks.map((b) => b.answer);
    blanks.forEach((b) => {
      const others = shuffle(
        pool.filter((a) => a.toLowerCase() !== b.answer.toLowerCase()),
      ).slice(0, 3);
      const extra = shuffle(
        FALLBACK_DISTRACTORS.filter(
          (w) => w.toLowerCase() !== b.answer.toLowerCase() && !others.includes(w),
        ),
      ).slice(0, Math.max(0, 3 - others.length));
      map[b.id] = shuffle([b.answer, ...others, ...extra]);
    });
    return map;
  }, [blanks]);

  const finished = Object.keys(done).length === total && total > 0;
  const score = Math.max(0, correctCount * 100 - misses * 20 - hintsUsed.length * 10);

  useEffect(() => {
    if (finished && !notified.current) {
      notified.current = true;
      onComplete?.(score, correctCount, total);
    }
  }, [finished, score, correctCount, total, onComplete]);

  const current = blanks[index];

  const goNext = useCallback(
    (fromId: string) => {
      const nextIdx = blanks.findIndex((b, i) => i > blanks.findIndex((x) => x.id === fromId) && !done[b.id]);
      const firstPending = blanks.findIndex((b) => !done[b.id] && b.id !== fromId);
      setIndex(nextIdx >= 0 ? nextIdx : firstPending >= 0 ? firstPending : index);
    },
    [blanks, done, index],
  );

  const answer = (option: string) => {
    if (!current) return;
    if (option.toLowerCase().trim() === current.answer.toLowerCase().trim()) {
      playTone("ok");
      setDone((d) => ({ ...d, [current.id]: true }));
      setCorrectCount((c) => c + 1);
      setWrong(null);
      setShowHint(false);
      goNext(current.id);
    } else {
      playTone("bad");
      setWrong(option);
      setMisses((m) => m + 1);
      window.setTimeout(() => setWrong(null), 700);
    }
  };

  const skip = () => {
    if (!current) return;
    setDone((d) => ({ ...d, [current.id]: true }));
    setMisses((m) => m + 1);
    setShowHint(false);
    goNext(current.id);
  };

  const restart = () => {
    notified.current = false;
    setIndex(0);
    setDone({});
    setWrong(null);
    setShowHint(false);
    setHintsUsed([]);
    setMisses(0);
    setCorrectCount(0);
  };

  if (total === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Esta música ainda não tem lacunas cadastradas para o Modo Escuta.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    return (
      <Card className="border-primary/40 bg-primary/5 border">
        <CardContent className="p-6 text-center space-y-3">
          <Trophy className="h-8 w-8 mx-auto text-primary" />
          <p className="font-display font-bold text-foreground text-lg">
            Modo Escuta concluído — {score} pontos
          </p>
          <p className="text-sm text-muted-foreground">
            {correctCount}/{total} acertos · {misses} erros · {hintsUsed.length} dicas usadas
          </p>
          <Button variant="outline" onClick={restart}>
            <RotateCcw className="h-4 w-4 mr-2" /> Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              Acertos: {correctCount}/{total}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-primary" /> {score} pts
            </span>
          </div>
          <Progress value={(Object.keys(done).length / total) * 100} className="h-2" />
        </div>

        {current && (
          <div className="rounded-xl border border-primary bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-bold shrink-0">
                {index + 1}
              </span>
              <p className="text-base md:text-lg leading-relaxed text-foreground font-medium">
                {current.text_before}
                <span className="inline-flex items-center justify-center min-w-[4.5rem] px-2 py-0.5 mx-1 rounded-md bg-primary/10 border border-primary/40 text-primary font-bold align-middle">
                  ___
                </span>
                {current.text_after}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(optionsByBlank[current.id] ?? []).map((opt) => (
                <Button
                  key={opt}
                  variant="outline"
                  onClick={() => answer(opt)}
                  className={`h-12 font-semibold text-base transition ${
                    wrong === opt
                      ? "border-destructive text-destructive"
                      : "hover:border-primary hover:bg-primary/10"
                  }`}
                >
                  {wrong === opt && <XCircle className="h-4 w-4 mr-1" />}
                  {opt}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {current.hint && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowHint((s) => !s);
                    if (!hintsUsed.includes(current.id)) setHintsUsed((h) => [...h, current.id]);
                  }}
                >
                  <Lightbulb className="h-4 w-4 mr-1 text-primary" /> Ver dica
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={skip}>
                Pular (−20 pts)
              </Button>
            </div>

            {showHint && current.hint && (
              <div className="rounded-lg bg-muted/60 border border-border/60 p-3 text-sm text-muted-foreground">
                {current.hint}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Progresso das lacunas
          </p>
          <div className="flex flex-wrap gap-2">
            {blanks.map((b, i) => {
              const isDone = !!done[b.id];
              const isCurrent = current?.id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    if (isDone) return;
                    setShowHint(false);
                    setWrong(null);
                    setIndex(i);
                  }}
                  className={`h-9 w-9 rounded-full text-sm font-bold border transition ${
                    isDone
                      ? "border-success/40 bg-success/10 text-success"
                      : isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40"
                  }`}
                  title={`Lacuna ${i + 1}`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4 mx-auto" /> : i + 1}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Music className="h-3.5 w-3.5 text-primary" /> Toque a música ao lado e escolha a palavra que
            você ouvir.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
