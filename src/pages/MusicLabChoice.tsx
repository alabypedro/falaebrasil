import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Music, Lightbulb, CheckCircle2, XCircle, Trophy, RotateCcw } from "lucide-react";
import BackToDashboardButton from "@/components/BackToDashboardButton";

interface Exercise {
  id: number;
  pauseTimeSeconds: number;
  lyricContext: string;
  translation: string;
  correctAnswer: string;
  options: string[];
}

interface SongExercise {
  songTitle: string;
  artist: string;
  cefrLevel: string;
  youtubeVideoId: string;
  exercises: Exercise[];
}

/** Mock configurável — trocar por dados do banco quando disponível. */
export const MOCK_SONG: SongExercise = {
  songTitle: "Hello",
  artist: "Adele",
  cefrLevel: "A1",
  youtubeVideoId: "YQHsXMglC9A",
  exercises: [
    {
      id: 1,
      pauseTimeSeconds: 14,
      lyricContext: "Hello, it's ___",
      translation: "Olá, sou eu",
      correctAnswer: "me",
      options: ["me", "my", "you", "we"],
    },
    {
      id: 2,
      pauseTimeSeconds: 28,
      lyricContext: "I was wondering if after all these years you'd ___ to meet",
      translation:
        "Eu estava me perguntando se depois de todos esses anos você gostaria de se encontrar",
      correctAnswer: "like",
      options: ["like", "love", "want", "hope"],
    },
  ],
};

/** Carrega a API oficial do YouTube uma única vez. */
function useYouTubeApi() {
  const [ready, setReady] = useState(!!(window as any).YT?.Player);
  useEffect(() => {
    if ((window as any).YT?.Player) {
      setReady(true);
      return;
    }
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      setReady(true);
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  }, []);
  return ready;
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

export default function MusicLabChoice() {
  const song = MOCK_SONG;
  const apiReady = useYouTubeApi();
  const playerRef = useRef<any>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const [current, setCurrent] = useState<Exercise | null>(null);
  const [doneIds, setDoneIds] = useState<number[]>([]);
  const [filled, setFilled] = useState<Record<number, string>>({});
  const [wrong, setWrong] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const total = song.exercises.length;
  const finished = doneIds.length === total;
  const score = Math.max(
    0,
    correctCount * 100 - misses * 20 - hintsUsed.length * 10,
  );

  const currentRef = useRef<Exercise | null>(null);
  const doneRef = useRef<number[]>([]);
  currentRef.current = current;
  doneRef.current = doneIds;

  // Player oficial + monitoramento do tempo de reprodução
  useEffect(() => {
    if (!apiReady || !mountRef.current || playerRef.current) return;
    playerRef.current = new (window as any).YT.Player(mountRef.current, {
      videoId: song.youtubeVideoId,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
    });

    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime || currentRef.current) return;
      const t = p.getCurrentTime();
      const next = song.exercises.find(
        (e) =>
          !doneRef.current.includes(e.id) &&
          t >= e.pauseTimeSeconds &&
          t < e.pauseTimeSeconds + 1.2,
      );
      if (next) {
        p.pauseVideo?.();
        setShowTranslation(false);
        setWrong(null);
        setCurrent(next);
      }
    }, 250);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [apiReady, song.youtubeVideoId, song.exercises]);

  const answer = useCallback(
    (option: string) => {
      const ex = current;
      if (!ex) return;
      if (option === ex.correctAnswer) {
        playTone("ok");
        setFilled((f) => ({ ...f, [ex.id]: option }));
        setDoneIds((d) => [...d, ex.id]);
        setCorrectCount((c) => c + 1);
        setWrong(null);
        setCurrent(null);
        setShowTranslation(false);
        window.setTimeout(() => playerRef.current?.playVideo?.(), 600);
      } else {
        playTone("bad");
        setWrong(option);
        setMisses((m) => m + 1);
        window.setTimeout(() => setWrong(null), 700);
      }
    },
    [current],
  );

  const skip = useCallback(() => {
    const ex = current;
    if (!ex) return;
    setFilled((f) => ({ ...f, [ex.id]: ex.correctAnswer }));
    setDoneIds((d) => [...d, ex.id]);
    setMisses((m) => m + 1);
    setCurrent(null);
    setShowTranslation(false);
    playerRef.current?.playVideo?.();
  }, [current]);

  const restart = () => {
    setCurrent(null);
    setDoneIds([]);
    setFilled({});
    setWrong(null);
    setShowTranslation(false);
    setHintsUsed([]);
    setMisses(0);
    setCorrectCount(0);
    playerRef.current?.seekTo?.(0, true);
    playerRef.current?.playVideo?.();
  };

  const lyricWithFill = (ex: Exercise) =>
    filled[ex.id] ? ex.lyricContext.replace("___", filled[ex.id]) : ex.lyricContext;

  return (
    <div className="max-w-4xl mx-auto space-y-6 page-transition">
      <BackToDashboardButton />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" /> Music Lab
          </h1>
          <Badge className="bg-primary/15 text-primary border border-primary/30 font-semibold">
            Nível {song.cefrLevel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {song.songTitle} — {song.artist}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              Acertos: {correctCount}/{total}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-primary" /> {score} pts
            </span>
          </div>
          <Progress value={(doneIds.length / total) * 100} className="h-2" />
        </div>
      </header>

      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-0">
          <div className="aspect-video w-full [&>*]:h-full [&>*]:w-full">
            <div ref={mountRef} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-5 space-y-5">
          {song.exercises.map((ex, i) => {
            const isCurrent = current?.id === ex.id;
            const isDone = doneIds.includes(ex.id);
            return (
              <div
                key={ex.id}
                className={`rounded-xl border p-4 space-y-3 transition ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : isDone
                      ? "border-success/40 bg-success/5"
                      : "border-border/60 opacity-70"
                }`}
              >
                <div className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                  <p className="text-foreground font-medium">
                    {isDone ? (
                      lyricWithFill(ex)
                    ) : (
                      <>
                        {ex.lyricContext.split("___")[0]}
                        <span className="inline-block min-w-16 border-b-2 border-primary align-middle mx-1" />
                        {ex.lyricContext.split("___")[1]}
                      </>
                    )}
                  </p>
                  {isDone && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />}
                </div>

                {isCurrent && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {ex.options.map((opt) => {
                        const isWrong = wrong === opt;
                        return (
                          <Button
                            key={opt}
                            variant="outline"
                            onClick={() => answer(opt)}
                            className={`h-11 font-semibold ${
                              isWrong
                                ? "border-destructive text-destructive animate-[shake_0.4s_ease-in-out]"
                                : "hover:border-primary hover:bg-primary/10"
                            }`}
                          >
                            {isWrong && <XCircle className="h-4 w-4 mr-1" />}
                            {opt}
                          </Button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowTranslation((s) => !s);
                          if (!hintsUsed.includes(ex.id)) setHintsUsed((h) => [...h, ex.id]);
                        }}
                      >
                        <Lightbulb className="h-4 w-4 mr-1 text-primary" /> Ver Tradução
                      </Button>
                      <Button size="sm" variant="ghost" onClick={skip}>
                        Pular (−20 pts)
                      </Button>
                    </div>

                    {showTranslation && (
                      <div className="rounded-lg bg-muted/60 border border-border/60 p-3 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1">
                        {ex.translation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {finished && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 text-center space-y-2">
              <Trophy className="h-7 w-7 mx-auto text-primary" />
              <p className="font-display font-bold text-foreground">
                Exercício concluído — {score} pontos
              </p>
              <p className="text-sm text-muted-foreground">
                {correctCount}/{total} acertos · {misses} erros · {hintsUsed.length} traduções usadas
              </p>
              <Button variant="outline" onClick={restart}>
                <RotateCcw className="h-4 w-4 mr-2" /> Tentar de novo
              </Button>
            </div>
          )}

          {!current && !finished && (
            <p className="text-xs text-muted-foreground text-center">
              Dê play no vídeo: ele pausa sozinho em cada lacuna para você escolher a palavra.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
