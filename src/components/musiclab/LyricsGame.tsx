import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Loader2, RotateCcw, Trophy, ExternalLink } from 'lucide-react';
import { youtubeId, youtubeWatch } from '@/lib/musicMedia';
import { cleanWord, makeOptions, pointsForAttempt, prepareLines, wordKey, type LyricsActivity } from '@/lib/cantaeGame';

interface Player {
  getCurrentTime(): number; getPlayerState(): number;
  pauseVideo(): void; playVideo(): void; seekTo(seconds: number, allow: boolean): void; destroy(): void;
}
interface YouTubeAPI { Player: new (element: HTMLElement, config: Record<string, unknown>) => Player }
type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void };
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const win = window as YouTubeWindow;
    if (win.YT?.Player) { resolve(win.YT); return; }
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => { previous?.(); if (win.YT) resolve(win.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { apiPromise = undefined; reject(new Error('YouTube indisponível')); };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export default function LyricsGame({ activity, title }: { activity: LyricsActivity; title: string }) {
  const [lines, setLines] = useState(() => prepareLines(activity.lines));
  const [lineIndex, setLineIndex] = useState(0);
  const [gapIndex, setGapIndex] = useState(0);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [time, setTime] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const progress = useRef({ lineIndex, finished: false });
  const clickLock = useRef(false);
  const linesRef = useRef(activity.lines);
  linesRef.current = activity.lines;
  const finished = lineIndex >= lines.length;
  progress.current = { lineIndex, finished };
  const current = lines[lineIndex];
  const gap = current?.gaps[gapIndex];
  const answer = gap === undefined ? '' : cleanWord(current.words[gap]);
  const upcoming = useMemo(() => lines.slice(lineIndex).flatMap(line => line.gaps.map(i => cleanWord(line.words[i]))), [lines, lineIndex]);
  const options = useMemo(() => answer ? makeOptions(answer, upcoming) : [], [answer, upcoming, gapIndex]);
  const active = ready && !finished && time + 0.15 >= (current?.start ?? 0);
  const videoId = youtubeId(activity.youtube_url);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    loadApi().then(api => {
      if (cancelled || !container.current || !videoId) return;
      const target = document.createElement('div');
      container.current.replaceChildren(target);
      const instance = new api.Player(target, {
        videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, cc_load_policy: 0, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
          onError: () => { if (!cancelled) setError(true); },
        },
      });
      player.current = instance;
      interval = setInterval(() => {
        if (cancelled || !instance.getCurrentTime) return;
        const seconds = instance.getCurrentTime();
        setTime(seconds);
        const state = progress.current;
        const next = linesRef.current[state.lineIndex + 1];
        // Hold playback instead of skipping an unanswered sentence; no timed penalty.
        if (!state.finished && next && seconds >= next.start && instance.getPlayerState() === 1) instance.pauseVideo();
      }, 150);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; if (interval) clearInterval(interval); player.current?.destroy(); player.current = null; };
  }, [videoId]);

  useEffect(() => { clickLock.current = false; }, [lineIndex, gapIndex]);
  const choose = (word: string) => {
    if (!active || gap === undefined || clickLock.current || wrong.includes(word)) return;
    if (wordKey(word) !== wordKey(answer)) { setWrong(prev => [...prev, word]); return; }
    clickLock.current = true;
    setScore(value => value + pointsForAttempt(wrong.length + 1));
    setSolved(prev => ({ ...prev, [`${lineIndex}:${gap}`]: true }));
    setWrong([]);
    if (gapIndex + 1 < current.gaps.length) setGapIndex(value => value + 1);
    else {
      setGapIndex(0);
      setLineIndex(value => value + 1);
      if (player.current?.getPlayerState() === 2) player.current.playVideo();
    }
  };
  const restart = () => {
    setLines(prepareLines(activity.lines)); setLineIndex(0); setGapIndex(0); setSolved({}); setWrong([]); setScore(0);
    player.current?.seekTo(0, true); setTime(0); player.current?.pauseVideo();
  };

  return <section className="mx-auto w-full max-w-4xl space-y-4">
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" onClick={() => setLyricsOpen(true)}><BookOpen className="mr-2 h-4 w-4" />lyrics</Button>
      <Button variant="ghost" size="icon" title="Recomeçar" aria-label="Recomeçar" onClick={restart}><RotateCcw className="h-4 w-4" /></Button>
    </div>
    <div className="grid grid-cols-4 gap-2" aria-label="Palavras disponíveis">
      {(options.length ? options : ['—', '—', '—', '—']).map((word, i) => <Button key={`${lineIndex}:${gapIndex}:${i}`} variant={wrong.includes(word) ? 'destructive' : 'outline'} disabled={!active || wrong.includes(word)} onClick={() => choose(word)} className="h-14 min-w-0 whitespace-normal break-words px-1 text-sm sm:text-lg font-semibold">{word}</Button>)}
    </div>
    <div className="aspect-video w-full overflow-hidden bg-muted relative">
      <div ref={container} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
      {!ready && !error && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Este clipe não pôde ser reproduzido aqui. Escolha outro clipe oficial no Admin.</p>}
    {videoId && <a href={youtubeWatch(videoId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"><ExternalLink className="h-3 w-3" />Abrir clipe no YouTube</a>}
    <footer className="border-t border-border pt-4 space-y-4">
      <div className="flex justify-between items-center text-sm text-muted-foreground tabular-nums"><span>{Math.min(lineIndex + 1, lines.length)} / {lines.length}</span><span className="flex items-center gap-2 text-primary font-semibold"><Trophy className="h-4 w-4" />{score} pts</span></div>
      {finished ? <div className="py-6 text-center space-y-3"><Trophy className="h-8 w-8 mx-auto text-primary" /><h2 className="text-xl font-semibold">Música concluída</h2><p className="text-muted-foreground">{score} pontos</p><Button variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Tentar novamente</Button></div> :
        <div className="min-h-48 space-y-5" aria-live="polite">
          {lines.slice(lineIndex, lineIndex + 3).map((line, offset) => <p key={lineIndex + offset} className={offset === 0 ? 'text-xl sm:text-2xl leading-relaxed font-semibold text-foreground motion-safe:animate-in motion-safe:fade-in' : 'text-base leading-relaxed text-muted-foreground'}>
            {line.words.map((word, i) => <span key={i}>{line.gaps.includes(i) && !solved[`${lineIndex + offset}:${i}`] ? <span className={`inline-flex w-10 align-middle justify-center ${offset === 0 && gap === i ? 'text-primary' : 'text-muted-foreground'}`} aria-label="Palavra faltando"><Loader2 className="h-5 w-5 motion-safe:animate-spin" /></span> : word}{' '}</span>)}
          </p>)}
        </div>}
    </footer>
    <Dialog open={lyricsOpen} onOpenChange={setLyricsOpen}><DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{title} — lyrics</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-x-6 py-2 text-xs font-semibold uppercase text-muted-foreground border-b border-border"><span>English</span><span>Português</span></div>
      <div className="py-2">{activity.lines.map((line, i) => <div key={i} className="grid grid-cols-2 gap-x-6 py-1.5"><p className="text-base leading-relaxed font-medium text-foreground">{line.en}</p><p className="text-base leading-relaxed text-muted-foreground">{line.pt}</p></div>)}</div>
    </DialogContent></Dialog>
  </section>;
}