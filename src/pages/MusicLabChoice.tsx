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

  const currentEx = current;

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

      {finished ? (
        <Card className="border-primary/40 bg-primary/5 border">
          <CardContent className="p-6 text-center space-y-3">
            <Trophy className="h-8 w-8 mx-auto text-primary" />
            <p className="font-display font-bold text-foreground text-lg">
              Exercício concluído — {score} pontos
            </p>
            <p className="text-sm text-muted-foreground">
              {correctCount}/{total} acertos · {misses} erros · {hintsUsed.length} traduções usadas
            </p>
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="h-4 w-4 mr-2" /> Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-5">
            {currentEx ? (
              <div className="rounded-xl border border-primary bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-bold shrink-0">
                    {song.exercises.findIndex((e) => e.id === currentEx.id) + 1}
                  </span>
                  <p className="text-lg md:text-xl leading-relaxed text-foreground font-medium">
                    {lyricWithFill(currentEx).split(filled[currentEx.id] ?? "___").length > 1 ? (
                      lyricWithFill(currentEx)
                    ) : (
                      <>
                        {currentEx.lyricContext.split("___")[0]}
                        <span className="inline-flex items-center justify-center min-w-[4.5rem] px-2 py-0.5 mx-1 rounded-md bg-primary/10 border border-primary/40 text-primary font-bold align-middle">
                          {filled[currentEx.id] ?? "___"}
                        </span>
                        {currentEx.lyricContext.split("___")[1]}
                      </>
                    )}
                  </p>
                  {doneIds.includes(currentEx.id) && (
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-1" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {currentEx.options.map((opt) => {
                    const isWrong = wrong === opt;
                    const isFilled = filled[currentEx.id] === opt;
                    return (
                      <Button
                        key={opt}
                        variant="outline"
                        onClick={() => answer(opt)}
                        className={`h-12 font-semibold text-base transition ${
                          isFilled
                            ? "border-success text-success bg-success/10 hover:bg-success/10"
                            : isWrong
                              ? "border-destructive text-destructive animate-[shake_0.4s_ease-in-out]"
                              : "hover:border-primary hover:bg-primary/10"
                        }`}
                      >
                        {isWrong && <XCircle className="h-4 w-4 mr-1" />}
                        {isFilled && <CheckCircle2 className="h-4 w-4 mr-1" />}
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
                      if (!hintsUsed.includes(currentEx.id)) setHintsUsed((h) => [...h, currentEx.id]);
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
                    {currentEx.translation}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  Dê play no vídeo: ele pausa sozinho em cada lacuna para você escolher a palavra.
                </p>
                <Button variant="outline" onClick={() => playerRef.current?.playVideo?.()}>
                  <Music className="h-4 w-4 mr-2" /> Tocar música
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Progresso das lacunas
              </p>
              <div className="flex flex-wrap gap-2">
                {song.exercises.map((ex, i) => {
                  const isDone = doneIds.includes(ex.id);
                  const isCurrent = current?.id === ex.id;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => {
                        if (isDone) return;
                        playerRef.current?.pauseVideo?.();
                        setShowTranslation(false);
                        setWrong(null);
                        setCurrent(ex);
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
