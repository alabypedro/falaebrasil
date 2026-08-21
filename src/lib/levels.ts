export const LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "T1",
  "T2",
  "T3",
  "T4",
  "K1",
  "K2",
  "K3",
  "K4",
] as const;

export type Level = typeof LEVELS[number];

export const LEVEL_LIST: string[] = [...LEVELS];

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}
