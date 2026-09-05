import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, RotateCcw } from "lucide-react";

const SPEEDS = [0.75, 1, 1.25];

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * Player da narração do capítulo.
 * O elemento <audio> nunca é desmontado durante a leitura, então a narração
 * continua tocando enquanto o aluno usa o "Click-to-Define" no texto.
 */
export default function ChapterAudioPlayer({ src, label }: { src: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = speed;
      await el.play().catch(() => undefined);
      setPlaying(!el.paused);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const seek = (pct: number) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = (pct / 100) * duration;
    setCurrent(el.currentTime);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur p-3 space-y-2">
      <div className="flex items-center gap-3">
        <Button size="icon" onClick={toggle} aria-label={playing ? "Pausar narração" : "Ouvir narração"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground truncate">
            {label ?? "Audiolivro — ouça enquanto lê"}
          </p>
          <Slider value={[pct]} max={100} step={0.1} onValueChange={(v) => seek(v[0])} aria-label="Progresso do áudio" />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
          {fmt(current)} / {fmt(duration)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground mr-1">Velocidade</span>
        {SPEEDS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={speed === s ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => setSpeed(s)}
          >
            {s}x
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => seek(0)}
          aria-label="Reiniciar narração"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Início
        </Button>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
