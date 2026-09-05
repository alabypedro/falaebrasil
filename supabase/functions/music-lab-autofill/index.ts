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

    const body = await req.json();
    const url: string = (body?.url ?? "").toString().trim();
    const title: string = (body?.title ?? "").toString().trim();
    const artist: string = (body?.artist ?? "").toString().trim();
    const level: string = (body?.level ?? "A1").toString().trim();
    if (!url && !(title && artist)) {
      return json({ error: "Informe o link da música ou título + artista" }, 400);
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const system = `Você é um designer de atividades de inglês para brasileiros.
Receberá o link (e possivelmente título/artista) de uma música em inglês. Identifique a música pelo que sabe dela.
Gere uma atividade "Fill in the Blanks" com 8 a 12 lacunas usando trechos CURTOS e reconhecíveis da letra (máx. ~12 palavras por linha, em ordem cronológica da música).
Para cada lacuna: text_before (trecho antes, pode ser vazio), answer (UMA palavra ou expressão curta em inglês que foi removida), text_after (trecho depois, pode ser vazio) e hint curta em português.
Gere também 6 a 10 itens de "Vocabulário & Expressões" com termos reais da música: kind deve ser exatamente um de "slang", "phrasal_verb", "phonetics", "expression"; explanation em português simples; example uma frase curta em inglês.
Adeque a dificuldade ao nível ${level} (A1-C2 adultos, T1-T4 teens, K1-K4 kids). Nunca reproduza a letra completa — apenas trechos curtos.
Responda SOMENTE com JSON válido no formato:
{"title":"","artist":"","description":"","blanks":[{"text_before":"","answer":"","text_after":"","hint":""}],"vocab":[{"term":"","kind":"expression","explanation":"","example":""}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Link: ${url || "(não informado)"}\nTítulo: ${title || "(desconhecido)"}\nArtista: ${artist || "(desconhecido)"}\nNível: ${level}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) return json({ error: "Limite de uso da IA atingido. Tente em instantes." }, 429);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return json({ error: `AI error ${res.status}: ${t}` }, 500);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const kinds = ["slang", "phrasal_verb", "phonetics", "expression"];
    const blanks = Array.isArray(parsed.blanks)
      ? (parsed.blanks as Record<string, string>[])
          .filter((b) => b?.answer?.toString().trim())
          .slice(0, 15)
          .map((b) => ({
            text_before: (b.text_before ?? "").toString(),
            answer: (b.answer ?? "").toString().trim(),
            text_after: (b.text_after ?? "").toString(),
            hint: (b.hint ?? "").toString(),
          }))
      : [];
    const vocab = Array.isArray(parsed.vocab)
      ? (parsed.vocab as Record<string, string>[])
          .filter((v) => v?.term?.toString().trim() && v?.explanation?.toString().trim())
          .slice(0, 15)
          .map((v) => ({
            term: (v.term ?? "").toString().trim(),
            kind: kinds.includes((v.kind ?? "").toString()) ? (v.kind as string) : "expression",
            explanation: (v.explanation ?? "").toString().trim(),
            example: (v.example ?? "").toString().trim(),
          }))
      : [];

    if (!blanks.length && !vocab.length) {
      return json({ error: "Não consegui identificar essa música. Preencha título e artista e tente novamente." }, 422);
    }

    return json({
      title: (parsed.title ?? "").toString().trim(),
      artist: (parsed.artist ?? "").toString().trim(),
      description: (parsed.description ?? "").toString().trim(),
      blanks,
      vocab,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
