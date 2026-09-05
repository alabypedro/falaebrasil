import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Thumbs = Record<string, { url?: string } | undefined>;

const bestThumb = (t: Thumbs | undefined, videoId: string) =>
  t?.maxres?.url ??
  t?.standard?.url ??
  t?.high?.url ??
  t?.medium?.url ??
  t?.default?.url ??
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

/** Extrai o ID do vídeo de qualquer formato de URL do YouTube. */
const youtubeId = (url: string): string | null => {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authed.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await authed.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

    const API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!API_KEY) return json({ error: "YOUTUBE_API_KEY ausente" }, 500);

    const body = await req.json().catch(() => ({}));
    const action = (body?.action ?? "video").toString();

    if (action === "search") {
      const q = (body?.query ?? "").toString().trim();
      if (!q) return json({ error: "Informe o que deseja buscar" }, 400);
      const max = Math.min(Math.max(Number(body?.limit ?? 8) || 8, 1), 15);
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("maxResults", String(max));
      url.searchParams.set("q", q);
      url.searchParams.set("key", API_KEY);
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return json({ error: `YouTube API ${res.status}: ${t}` }, 502);
      }
      const data = await res.json();
      const items = (data?.items ?? []).map((it: Record<string, any>) => {
        const id = it?.id?.videoId as string;
        const s = it?.snippet ?? {};
        return {
          media_id: id,
          title: (s.title ?? "").toString(),
          channel: (s.channelTitle ?? "").toString(),
          cover_url: bestThumb(s.thumbnails as Thumbs, id),
          url: `https://www.youtube.com/watch?v=${id}`,
        };
      });
      return json({ items });
    }

    // action === "video": detalhes de um vídeo pela URL ou ID
    const raw = (body?.url ?? body?.videoId ?? "").toString().trim();
    const videoId = youtubeId(raw);
    if (!videoId) return json({ error: "Link do YouTube inválido" }, 400);

    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", API_KEY);
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return json({ error: `YouTube API ${res.status}: ${t}` }, 502);
    }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return json({ error: "Vídeo não encontrado no YouTube" }, 404);
    const s = item.snippet ?? {};
    const rawTitle: string = (s.title ?? "").toString();
    // "Artista - Música (Official Video)" -> separa artista e título quando possível
    const dash = rawTitle.split(/\s+[-–—]\s+/);
    const clean = (v: string) =>
      v.replace(/\s*[\(\[][^\)\]]*(official|video|audio|lyrics|hd|4k|remaster)[^\)\]]*[\)\]]/gi, "").trim();
    const artist = dash.length > 1 ? clean(dash[0]) : (s.channelTitle ?? "").toString().replace(/\s*-\s*Topic$/i, "");
    const title = dash.length > 1 ? clean(dash.slice(1).join(" - ")) : clean(rawTitle);

    return json({
      media_id: videoId,
      media_type: "youtube",
      title,
      artist,
      raw_title: rawTitle,
      channel: (s.channelTitle ?? "").toString(),
      cover_url: bestThumb(s.thumbnails as Thumbs, videoId),
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
