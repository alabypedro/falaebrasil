import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_TOPICS = [
  "Descreva como foi seu café da manhã hoje.",
  "Conte sobre o trajeto que você faz para o trabalho ou escola.",
  "Fale sobre o que você costuma fazer aos finais de semana.",
  "Descreva sua refeição favorita do dia a dia.",
  "Conte como foi seu último encontro com um amigo.",
  "Fale sobre seus aplicativos favoritos no celular.",
  "Descreva como você organiza sua casa durante a semana.",
  "Conte sobre uma compra recente no supermercado.",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Auth check (function runs without verify_jwt by default)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recent: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.recent)) {
        recent = body.recent.filter((s: unknown): s is string => typeof s === "string").slice(0, 8);
      }
    } catch (_) {
      // no body is fine
    }

    if (!LOVABLE_API_KEY) {
      const fallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você gera UM tema de prática de conversação livre em inglês para alunos brasileiros nível A1/A2.
REGRAS:
- Responda SEMPRE em PORTUGUÊS do Brasil (apenas o enunciado do tema).
- O tema deve ser sobre a VIDA COTIDIANA / dia a dia: rotina, trabalho, estudos, família, amigos, comida, casa, transporte, compras, lazer simples, saúde, hobbies, clima, tecnologia do dia a dia, finais de semana, planos simples.
- Frase curta (máx. 18 palavras), começa com um verbo no imperativo (Descreva, Conte, Fale sobre, Explique, Compare).
- Termina com "em inglês." OU peça implicitamente para falar em inglês.
- NÃO use aspas, emojis, listas, markdown ou explicações. Só o enunciado.
- Evite repetir temas recentes.`;

    const userPrompt = recent.length
      ? `Gere um novo tema diferente destes recentes: ${recent.map((r) => `"${r}"`).join(", ")}`
      : `Gere um tema de prática de conversação cotidiana.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos na sua workspace Lovable." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      const fallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let topic: string = data?.choices?.[0]?.message?.content ?? "";
    topic = topic.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
    if (!topic || topic.length > 220) {
      topic = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
    }

    return new Response(JSON.stringify({ topic, source: "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-unscripted-topic error", e);
    const fallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
    return new Response(JSON.stringify({ topic: fallback, source: "fallback-error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});