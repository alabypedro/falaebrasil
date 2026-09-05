export type MediaType = "youtube" | "spotify";

/** Extrai o ID do vídeo de qualquer formato de URL do YouTube. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null;
}

/** Extrai o track ID de uma URL/URI do Spotify (embed público, sem OAuth). */
export function spotifyTrackId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([A-Za-z0-9]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{22}$/.test(url.trim()) ? url.trim() : null;
}

/** Detecta tipo e ID da mídia a partir de uma URL colada. */
export function detectMedia(url: string): { media_type: MediaType; media_id: string } | null {
  const yt = youtubeId(url);
  if (yt) return { media_type: "youtube", media_id: yt };
  const sp = spotifyTrackId(url);
  if (sp) return { media_type: "spotify", media_id: sp };
  return null;
}

export const youtubeEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;

export const spotifyEmbed = (id: string) =>
  `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;

/** Capa oficial do vídeo do YouTube (não requer chave de API). */
export const youtubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
