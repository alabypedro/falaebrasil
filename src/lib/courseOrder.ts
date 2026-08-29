import { LEVELS } from "./levels";

/** Ordem canônica de exibição de cursos no painel admin. */
export type SegmentGroup = "Adultos" | "Teens" | "Kids" | "Outros";

export const SEGMENT_GROUP_ORDER: SegmentGroup[] = ["Adultos", "Teens", "Kids", "Outros"];

const LEVEL_INDEX = new Map<string, number>(LEVELS.map((l, i) => [l, i]));

export interface CourseLike {
  id: string;
  title: string;
  level?: string | null;
}

/** Nível de um curso: usa a coluna `level`, com fallback no título ("FB Kids 3", "(A1)"). */
export function levelOf(course: CourseLike): string {
  const lvl = (course.level ?? "").toUpperCase().trim();
  if (LEVEL_INDEX.has(lvl)) return lvl;
  const title = course.title ?? "";
  const paren = title.match(/\(([A-C][12])\)/i);
  if (paren && LEVEL_INDEX.has(paren[1].toUpperCase())) return paren[1].toUpperCase();
  const kids = title.match(/kids\s*([1-4])/i);
  if (kids) return `K${kids[1]}`;
  const teens = title.match(/teens\s*([1-4])/i);
  if (teens) return `T${teens[1]}`;
  return "";
}

export function levelRank(level?: string | null): number {
  const idx = LEVEL_INDEX.get((level ?? "").toUpperCase());
  return idx === undefined ? 999 : idx;
}

export function segmentGroupOfLevel(level?: string | null): SegmentGroup {
  const l = (level ?? "").toUpperCase();
  if (/^K[1-4]$/.test(l)) return "Kids";
  if (/^T[1-4]$/.test(l)) return "Teens";
  if (/^[A-C][12]$/.test(l)) return "Adultos";
  return "Outros";
}

export function segmentGroupOf(course: CourseLike): SegmentGroup {
  return segmentGroupOfLevel(levelOf(course));
}

/** Comparador: Adultos (A1→C2) → Teens (T1→T4) → Kids (K1→K4) → outros (alfabético). */
export function compareCourses(a: CourseLike, b: CourseLike): number {
  const la = levelOf(a);
  const lb = levelOf(b);
  const ra = levelRank(la);
  const rb = levelRank(lb);
  if (ra !== rb) return ra - rb;
  return (a.title ?? "").localeCompare(b.title ?? "", "pt-BR", { numeric: true, sensitivity: "base" });
}

export function sortCourses<T extends CourseLike>(list: T[]): T[] {
  return [...list].sort(compareCourses);
}

/** Rótulo curto e legível: "A1 · FB Básico (A1)" → "A1 · FB Básico". */
export function courseLabel(course: CourseLike): string {
  const lvl = levelOf(course);
  const clean = (course.title ?? "").replace(/\s*\([A-C][12]\)\s*$/i, "").trim();
  return lvl ? `${lvl} · ${clean}` : clean || course.title;
}

/** Ordena qualquer item que tenha um curso vinculado (curso → ordem → título). */
export function compareByCourse<T extends { course?: CourseLike | null; display_order?: number | null; title?: string }>(
  a: T,
  b: T
): number {
  const ca = a.course;
  const cb = b.course;
  if (ca && cb) {
    const c = compareCourses(ca, cb);
    if (c !== 0) return c;
  } else if (ca || cb) {
    return ca ? -1 : 1;
  }
  const oa = a.display_order ?? 0;
  const ob = b.display_order ?? 0;
  if (oa !== ob) return oa - ob;
  return (a.title ?? "").localeCompare(b.title ?? "", "pt-BR", { numeric: true, sensitivity: "base" });
}
