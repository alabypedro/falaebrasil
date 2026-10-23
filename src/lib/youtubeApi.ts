export interface YTPlayer {
  getCurrentTime(): number; getPlayerState(): number;
  pauseVideo(): void; playVideo(): void; seekTo(seconds: number, allow: boolean): void; destroy(): void;
}
export interface YouTubeAPI { Player: new (element: HTMLElement, config: Record<string, unknown>) => YTPlayer }
type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void };
let apiPromise: Promise<YouTubeAPI> | undefined;
export function loadYouTubeApi() {
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
