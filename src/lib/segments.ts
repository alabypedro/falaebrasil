export type Segment = "kids" | "teens" | "adults";

export const SEGMENT_RANK: Record<Segment, number> = { kids: 1, teens: 2, adults: 3 };

/** Segmento de um curso a partir do required_tier. */
export function courseSegment(requiredTier?: string | null): Segment {
  const t = (requiredTier ?? "open").toLowerCase();
  if (t === "kids") return "kids";
  if (t === "teens") return "teens";
  return "adults";
}

/**
 * Segmento efetivo do aluno.
 * Admin e categoria OPEN => adults (acesso a tudo).
 * plan_tier kids/teens => segmento correspondente.
 * Caso contrário, deriva do segmento mais alto dos cursos liberados individualmente.
 */
export function userSegment(opts: {
  isAdmin?: boolean;
  hasOpen?: boolean;
  planTier?: string | null;
  grantedTiers?: (string | null | undefined)[];
}): Segment {
  if (opts.isAdmin || opts.hasOpen) return "adults";
  const tier = (opts.planTier ?? "open").toLowerCase();
  if (tier === "kids") return "kids";
  if (tier === "teens") return "teens";

  const granted = (opts.grantedTiers ?? []).map(courseSegment);
  if (granted.length === 0) return "adults";
  return granted.reduce<Segment>(
    (acc, s) => (SEGMENT_RANK[s] > SEGMENT_RANK[acc] ? s : acc),
    "kids"
  );
}

/** O aluno pode acessar um curso desse segmento? */
export function segmentAllows(user: Segment, course: Segment): boolean {
  return SEGMENT_RANK[user] >= SEGMENT_RANK[course];
}
