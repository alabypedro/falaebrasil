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

function extractPdfText(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];
  const tjRe = /\(([^)]*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw)) !== null) {
    const s = m[1]
      .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1");
    if (s.trim()) parts.push(s.trim());
  }
  const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = tjArrRe.exec(raw)) !== null) {
    const inner = /\(([^)]*)\)/g;
    let im: RegExpExecArray | null;
    const chunk: string[] = [];
    while ((im = inner.exec(m[1])) !== null) chunk.push(im[1]);
    const j = chunk.join("").trim();
    if (j) parts.push(j);
  }
  let text = parts.join(" ");
  if (!text.trim()) {
    text = raw.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s{3,}/g, "\n");
  }
  return text;
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
    const deck_id = String(form.get("deck_id") ?? "");
    const maxCards = Math.min(60, Math.max(5, parseInt(String(form.get("max_cards") ?? "20"), 10) || 20));
    if (!file) return json({ error: "PDF ausente" }, 400);
    if (!deck_id) return json({ error: "deck_id ausente" }, 400);

    const buf = new Uint8Array(await file.arrayBuffer());
    let text = extractPdfText(buf);
    // truncate to keep prompt small
    text = text.slice(0, 18000);
    if (text.trim().length < 50) return json({ error: "Não foi possível extrair texto do PDF" }, 400);

    // Ask AI to produce vocabulary flashcards
    const sys = `Você é um professor de inglês criando flashcards de vocabulário para alunos brasileiros.
A partir do texto de uma lição, escolha as ${maxCards} palavras ou expressões mais úteis para memorização (foco em vocabulário-chave, phrasal verbs, colocações e idioms — evite palavras triviais como "the", "and", "is").
Retorne SOMENTE um JSON válido no formato:
{"cards":[{"front":"palavra ou expressão em inglês","back":"tradução curta em português","example":"frase de exemplo em inglês do próprio texto (ou breve, se não houver)"}]}`;

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
          { role: "user", content: `Texto da lição:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `IA falhou: ${resp.status} ${t.slice(0, 200)}` }, 500);
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
    console.error("memorizae-import-pdf error", e);
    return json({ error: (e as Error).message }, 500);
  }
});