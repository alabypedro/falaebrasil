import { supabase } from "@/integrations/supabase/client";

export type AiSource = "memorizae" | "leiae" | "falae" | "escutae" | "escreveae" | "musiclab" | "books";

export const AI_LABELS: Record<AiSource, string> = {
  memorizae: "IA Memorizaê",
  falae: "IA Falaê",
  escutae: "IA Escutaê",
  escreveae: "IA Escreveaê",
  leiae: "IA Leiaê",
  musiclab: "Music Lab",
  books: "Livros e audio-livros",
};

export async function awardAiXp(source: AiSource, points: number, key?: string) {
  if (!points || points <= 0) return null;
  const _key = key ?? `${source}:${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("award_ai_xp" as any, {
    _source: source,
    _points: Math.min(500, Math.max(0, Math.round(points))),
    _key,
  });
  if (error) {
    console.warn("award_ai_xp failed", error.message);
    return null;
  }
  return data as { awarded: boolean; points: number; total_xp: number } | null;
}

export async function fetchAiXpBreakdown(userId: string): Promise<Record<AiSource, number> & { total: number }> {
  const empty = { memorizae: 0, falae: 0, escutae: 0, escreveae: 0, leiae: 0, musiclab: 0, books: 0, total: 0 };
  const { data, error } = await supabase
    .from("ai_xp_events" as any)
    .select("source, points")
    .eq("user_id", userId);
  if (error || !data) return empty;
  const out = { ...empty };
  (data as any[]).forEach((r) => {
    const s = r.source as AiSource;
    if (s in out) {
      (out as any)[s] += r.points ?? 0;
      out.total += r.points ?? 0;
    }
  });
  return out;
}