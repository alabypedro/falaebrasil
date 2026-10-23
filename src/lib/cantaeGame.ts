export interface LyricLine { en: string; pt: string; start: number }
export interface LyricsActivity { youtube_url: string; lines: LyricLine[] }
export interface GameLine extends LyricLine { words: string[]; gaps: number[] }

export function readLyricsActivity(value: unknown): LyricsActivity | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.youtube_url !== 'string' || !Array.isArray(obj.lines)) return null;
  const lines: LyricLine[] = [];
  for (const item of obj.lines) {
    if (!item || typeof item !== 'object') return null;
    const line = item as Record<string, unknown>;
    if (typeof line.en !== 'string' || !line.en.trim() || typeof line.pt !== 'string' || !line.pt.trim() || typeof line.start !== 'number' || !Number.isFinite(line.start) || line.start < 0) return null;
    if (lines.length && line.start <= lines[lines.length - 1].start) return null;
    lines.push({ en: line.en.trim(), pt: line.pt.trim(), start: line.start });
  }
  return lines.length ? { youtube_url: obj.youtube_url, lines } : null;
}

export function shuffled<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const cleanWord = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
export const wordKey = (word: string) => cleanWord(word).toLowerCase();
export function prepareLines(lines: LyricLine[], random = Math.random): GameLine[] {
  return lines.map(line => {
    const words = line.en.split(/\s+/);
    const eligible = words.map((word, i) => cleanWord(word) ? i : -1).filter(i => i >= 0);
    const count = eligible.length > 1 && random() >= 0.5 ? 2 : 1;
    return { ...line, words, gaps: shuffled(eligible, random).slice(0, count).sort((a, b) => a - b) };
  });
}
export function pointsForAttempt(attempt: number): number {
  return [100, 60, 30, 0][Math.min(3, Math.max(0, attempt - 1))] ?? 0;
}
/** Each "listen again" costs a few points, never going below zero. */
export const REPLAY_PENALTY = 5;
export const applyReplayPenalty = (score: number) => Math.max(0, score - REPLAY_PENALTY);
/** Small lead so a line marked on tap starts just before the singer. */
export const markedStart = (seconds: number) => Math.max(0, Math.round((seconds - 0.3) * 10) / 10);
export function makeOptions(answer: string, upcoming: string[], random = Math.random): string[] {
  const pool = [...upcoming, 'love', 'time', 'night', 'heart', 'world', 'dream'];
  const unique = new Map<string, string>();
  for (const word of pool) if (wordKey(word) && wordKey(word) !== wordKey(answer)) unique.set(wordKey(word), cleanWord(word));
  return shuffled([cleanWord(answer), ...shuffled([...unique.values()], random).slice(0, 3)], random);
}