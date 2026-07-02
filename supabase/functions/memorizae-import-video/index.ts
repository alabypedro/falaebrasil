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

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  // Chunked to avoid call stack overflow on large arrays
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function guessMime(name: string, fallback = "video/mp4"): string {
  const n = name.toLowerCase();
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".m4v")) return "video/x-m4v";
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE);
    const token = authHeader.slice(7);
    const { data: userData } = await admin.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const url = String(form.get("url") ?? "").trim();
    const deck_id = String(form.get("deck_id") ?? "");
    const maxCards = Math.min(60, Math.max(5, parseInt(String(form.get("max_cards") ?? "20"), 10) || 20));
    if (!deck_id) return json({ error: "deck_id ausente" }, 400);
    if (!file && !url) return json({ error: "Envie um arquivo de vídeo ou uma URL" }, 400);

    let bytes: Uint8Array;
    let mime = "video/mp4";
    if (file) {
      if (file.size > MAX_BYTES) return json({ error: "Vídeo muito grande (máx 20MB)" }, 400);
      bytes = new Uint8Array(await file.arrayBuffer());
      mime = file.type || guessMime(file.name);
    } else {
      const r = await fetch(url);
      if (!r.ok) return json({ error: `Falha ao baixar URL (${r.status})` }, 400);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) return json({ error: "Vídeo remoto muito grande (máx 20MB)" }, 400);
      bytes = buf;
      mime = r.headers.get("content-type")?.split(";")[0].trim() || guessMime(url);
      if (!mime.startsWith("video/")) {
        return json({ error: `Conteúdo não é vídeo (${mime}). Use mp4/webm/mov.` }, 400);
      }
    }

    const b64 = await bytesToBase64(bytes);
    const dataUrl = `data:${mime};base64,${b64}`;

    const sys = `Você é um professor de inglês criando flashcards de vocabulário para alunos brasileiros a partir de um vídeo em inglês.
Ouça/assista o vídeo e escolha as ${maxCards} palavras ou expressões mais úteis para memorização (foco em vocabulário-chave, phrasal verbs, colocações e idioms — evite palavras triviais como "the", "and", "is").
Retorne SOMENTE um JSON válido no formato:
{"cards":[{"front":"palavra ou expressão em inglês","back":"tradução curta em português","example":"frase de exemplo em inglês do vídeo (ou breve, se não houver)"}]}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: `Gere as ${maxCards} melhores flashcards deste vídeo.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `IA falhou: ${resp.status} ${t.slice(0, 300)}` }, 500);
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
    if (cards.length === 0) return json({ error: "IA não retornou cartas" }, 500);

    const { data: existing } = await admin
      .from("memorize_cards").select("id").eq("deck_id", deck_id);
    const startOrder = existing?.length ?? 0;

    const rows = cards
      .filter((c: any) => c?.front && c?.back)
      .slice(0, maxCards)
      .map((c: any, i: number) => ({
        deck_id,
        front_text: String(c.front).trim().slice(0, 300),
        back_text: String(c.back).trim().slice(0, 500),
        example_sentence: c.example ? String(c.example).trim().slice(0, 500) : null,
        display_order: startOrder + i,
      }));

    const { error: insErr } = await admin.from("memorize_cards").insert(rows);
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("memorizae-import-video error", e);
    return json({ error: (e as Error).message }, 500);
  }
});