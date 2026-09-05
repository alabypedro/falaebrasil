/**
 * Integração com a API pública do Internet Archive (coleção LibriVox).
 * Todas as obras são de domínio público e os arquivos .mp3 são servidos
 * diretamente pelo archive.org — não é necessária nenhuma chave de API.
 */

export interface LibrivoxWork {
  identifier: string;
  title: string;
  creator: string | null;
  year: string | null;
  coverUrl: string;
  pageUrl: string;
}

export interface LibrivoxTrack {
  name: string;
  title: string;
  track: number;
  durationSeconds: number | null;
  url: string;
}

const SEARCH_URL = "https://archive.org/advancedsearch.php";

/** Busca obras de domínio público narradas (LibriVox) em inglês. */
export async function searchLibrivoxWorks(query: string, rows = 20): Promise<LibrivoxWork[]> {
  const terms = query.trim();
  const q = terms
    ? `collection:librivoxaudio AND language:english AND (${terms})`
    : `collection:librivoxaudio AND language:english`;

  const params = new URLSearchParams();
  params.set("q", q);
  ["identifier", "title", "creator", "year"].forEach((f) => params.append("fl[]", f));
  params.set("rows", String(rows));
  params.set("page", "1");
  params.set("output", "json");
  params.set("sort[]", "downloads desc");

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao consultar o Internet Archive.");
  const json = await res.json();
  const docs: any[] = json?.response?.docs ?? [];

  return docs.map((d) => ({
    identifier: d.identifier,
    title: d.title ?? d.identifier,
    creator: Array.isArray(d.creator) ? d.creator.join(", ") : (d.creator ?? null),
    year: d.year ? String(d.year) : null,
    coverUrl: `https://archive.org/services/img/${d.identifier}`,
    pageUrl: `https://archive.org/details/${d.identifier}`,
  }));
}

/** Lista os capítulos em .mp3 de uma obra, já com a URL direta de streaming. */
export async function fetchLibrivoxTracks(identifier: string): Promise<LibrivoxTrack[]> {
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error("Falha ao carregar os arquivos da obra.");
  const json = await res.json();
  const files: any[] = json?.files ?? [];

  const mp3s = files.filter((f) => {
    const fmt = String(f.format ?? "").toLowerCase();
    const name = String(f.name ?? "").toLowerCase();
    // Prefere a versão de 64kbps (mais leve) e evita duplicatas de formato.
    return name.endsWith(".mp3") && (fmt.includes("64kbps") || fmt.includes("vbr"));
  });

  const preferred = mp3s.filter((f) => String(f.format).toLowerCase().includes("64kbps"));
  const chosen = preferred.length > 0 ? preferred : mp3s;

  return chosen
    .map((f, i) => ({
      name: f.name as string,
      title: (f.title as string) ?? (f.name as string),
      track: Number(String(f.track ?? i + 1).split("/")[0]) || i + 1,
      durationSeconds: f.length ? Math.round(parseFloat(f.length)) : null,
      url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
    }))
    .sort((a, b) => a.track - b.track);
}

export const formatTrackDuration = (s: number | null) => {
  if (!s || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};
