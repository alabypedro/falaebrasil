import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Hand, Undo2, Check } from 'lucide-react';
import { youtubeId } from '@/lib/musicMedia';
import { markedStart, type LyricLine } from '@/lib/cantaeGame';
import { loadYouTubeApi, type YTPlayer } from '@/lib/youtubeApi';

/** Admin tool: play the clip and tap when each line begins to record its start time. */
export default function LyricsSyncPanel({ url, lines, onChange, onDone }: { url: string; lines: LyricLine[]; onChange: (lines: LyricLine[]) => void; onDone: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const videoId = youtubeId(url);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(api => {
      if (cancelled || !container.current || !videoId) return;
      const target = document.createElement('div');
      container.current.replaceChildren(target);
      player.current = new api.Player(target, { videoId, width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, origin: window.location.origin }, events: { onReady: () => { if (!cancelled) setReady(true); } } });
    });
    return () => { cancelled = true; player.current?.destroy(); player.current = null; };
  }, [videoId]);

  const mark = () => {
    const i = indexRef.current;
    if (!player.current || i >= linesRef.current.length) return;
    const t = markedStart(player.current.getCurrentTime());
    const prev = linesRef.current[i - 1]?.start ?? -1;
    onChange(linesRef.current.map((l, n) => n === i ? { ...l, start: Math.max(t, prev + 0.1) } : l));
    setIndex(i + 1);
  };
  const back = () => {
    const i = Math.max(0, indexRef.current - 1);
    setIndex(i);
    const start = linesRef.current[i - 1]?.start ?? 0;
    player.current?.seekTo(Math.max(0, start), true);
    player.current?.playVideo();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) { e.preventDefault(); mark(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const done = index >= lines.length;
  return <div className="space-y-3 border border-border rounded-md p-3">
    <p className="text-sm text-muted-foreground">Dê play no vídeo. Toque em <b>Marcar</b> (ou na barra de espaço) no instante em que o cantor começa cada frase abaixo.</p>
    <div className="aspect-video w-full bg-muted relative overflow-hidden">
      <div ref={container} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
    </div>
    <div className="min-h-16 space-y-1">
      {done ? <p className="font-semibold text-primary">Todas as frases marcadas. Clique em Concluir e depois salve.</p> : <>
        <p className="text-xs text-muted-foreground">Frase {index + 1} de {lines.length} — marque quando começar:</p>
        <p className="text-lg font-semibold">{lines[index]?.en}</p>
        {lines[index + 1] && <p className="text-sm text-muted-foreground">Depois: {lines[index + 1].en}</p>}
      </>}
    </div>
    <div className="flex gap-2">
      <Button onClick={mark} disabled={!ready || done} className="flex-1"><Hand className="h-4 w-4 mr-2" />Marcar</Button>
      <Button variant="outline" onClick={back} disabled={!ready || index === 0}><Undo2 className="h-4 w-4 mr-2" />Refazer anterior</Button>
      <Button variant="outline" onClick={onDone}><Check className="h-4 w-4 mr-2" />Concluir</Button>
    </div>
  </div>;
}
