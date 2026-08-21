import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "T1", "T2", "T3", "T4", "K1", "K2", "K3", "K4"];

const FALLBACK_TOPICS: Record<string, string[]> = {
  A1: [
    "Descreva como foi seu café da manhã hoje, em inglês.",
    "Fale sobre sua família usando frases simples, em inglês.",
    "Conte o que você faz toda manhã, em inglês.",
  ],
  A2: [
    "Conte sobre o trajeto que você faz para o trabalho ou escola, em inglês.",
    "Fale sobre o que você costuma fazer aos finais de semana, em inglês.",
    "Descreva sua refeição favorita do dia a dia, em inglês.",
  ],
  B1: [
    "Conte como foi seu último encontro com um amigo e o que vocês fizeram, em inglês.",
    "Explique um problema que você resolveu no trabalho recentemente, em inglês.",
    "Fale sobre seus planos para os próximos meses, em inglês.",
  ],
  B2: [
    "Compare morar em uma cidade grande e em uma cidade pequena, em inglês.",
    "Fale sobre as vantagens e desvantagens do trabalho remoto, em inglês.",
    "Explique sua opinião sobre o uso de tecnologia no dia a dia, em inglês.",
  ],
  C1: [
    "Analise o impacto das redes sociais nas relações pessoais, em inglês.",
    "Defenda uma posição sobre sustentabilidade nas empresas, em inglês.",
    "Explique um tema complexo da sua área para alguém leigo, em inglês.",
  ],
  C2: [
    "Avalie criticamente uma tendência cultural atual com argumentos sofisticados, em inglês.",
    "Discuta um dilema ético contemporâneo apresentando pontos de vista opostos, em inglês.",
    "Apresente uma reflexão filosófica sobre o conceito de sucesso, em inglês.",
  ],
  T1: [
    "Fale sobre você e sua escola com frases simples, em inglês.",
    "Descreva seu jogo ou série favorita, em inglês.",
  ],
  T2: [
    "Conte o que você fez no último fim de semana, em inglês.",
    "Descreva sua rotina na escola, em inglês.",
  ],
  T3: [
    "Dê sua opinião sobre redes sociais para adolescentes, em inglês.",
    "Conte uma experiência marcante e o que você aprendeu, em inglês.",
  ],
  T4: [
    "Defenda uma opinião sobre esportes na escola, em inglês.",
    "Fale sobre um projeto que você gostaria de criar com seus amigos, em inglês.",
  ],
  K1: [
    "Fale suas cores favoritas e uma coisa dessa cor, em inglês.",
    "Diga o nome de cinco animais e um som que eles fazem, em inglês.",
  ],
  K2: [
    "Fale sobre sua família com frases curtas, em inglês.",
    "Descreva seu brinquedo favorito, em inglês.",
  ],
  K3: [
    "Conte o que você faz depois da escola, em inglês.",
    "Fale sobre seu dia favorito da semana, em inglês.",
  ],
  K4: [
    "Conte como foram suas últimas férias, em inglês.",
    "Descreva seu melhor amigo e o que vocês gostam de fazer, em inglês.",
  ],
};

const LEVEL_GUIDE: Record<string, string> = {
  A1: "adulto iniciante: vocabulário básico, presente simple, frases muito curtas",
  A2: "adulto básico: rotina, passado simples, frases curtas do cotidiano",
  B1: "adulto intermediário: narrar experiências, opiniões simples, planos",
  B2: "adulto intermediário-avançado: comparar, argumentar, temas sociais e de trabalho",
  C1: "adulto avançado: análise, abstração, vocabulário sofisticado",
  C2: "adulto proficiente: temas complexos, nuance, argumentação refinada",
  T1: "adolescente iniciante: escola, amigos, jogos, frases simples",
  T2: "adolescente básico: rotina escolar, fim de semana, hobbies",
  T3: "adolescente intermediário: opinião sobre temas juvenis, experiências",
  T4: "adolescente avançado: argumentação sobre temas escolares e sociais juvenis",
  K1: "criança iniciante: cores, animais, números, frases de 3-4 palavras",
  K2: "criança básica: família, brinquedos, casa, frases curtas",
  K3: "criança intermediária: escola, rotina do dia, comidas favoritas",
  K4: "criança avançada: contar histórias curtas sobre férias e amigos",
};


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
    let requestedLevel: string | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.recent)) {
        recent = body.recent.filter((s: unknown): s is string => typeof s === "string").slice(0, 8);
      }
      // Whitelist validation to prevent prompt injection via the `level` field
      if (typeof body?.level === "string" && ALLOWED_LEVELS.includes(body.level)) {
        requestedLevel = body.level;
      }
    } catch (_) {
      // no body is fine
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("level")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const userLevel = requestedLevel || (profile?.level as string | undefined) || "A1";
    const levelFallbacks = FALLBACK_TOPICS[userLevel] || FALLBACK_TOPICS["A1"];
    const pickFallback = () => levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ topic: pickFallback(), source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você gera UM tema de prática de conversação livre em inglês para alunos brasileiros.
Nível do aluno: ${userLevel} (${LEVEL_GUIDE[userLevel] ?? "adulto iniciante"}).
REGRAS:
- Responda SEMPRE em PORTUGUÊS do Brasil (apenas o enunciado do tema).
- O tema deve ser adequado à IDADE e ao NÍVEL ${userLevel}: níveis K são crianças, T são adolescentes, A/B/C são adultos.
- Temas do cotidiano apropriados ao público: rotina, escola/trabalho, família, amigos, comida, casa, transporte, compras, lazer, hobbies, clima, tecnologia, planos.
- Frase curta (máx. 18 palavras), começa com um verbo no imperativo (Descreva, Conte, Fale sobre, Explique, Compare).
- Termina com "em inglês.".
- NÃO use aspas, emojis, listas, markdown ou explicações. Só o enunciado.
- Evite repetir temas recentes.`;

    const userPrompt = recent.length
      ? `Gere um novo tema de nível ${userLevel} diferente destes recentes: ${recent.map((r) => `"${r}"`).join(", ")}`
      : `Gere um tema de prática de conversação cotidiana para o nível ${userLevel}.`;


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
      return new Response(JSON.stringify({ topic: pickFallback(), source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let topic: string = data?.choices?.[0]?.message?.content ?? "";
    topic = topic.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
    if (!topic || topic.length > 220) {
      topic = pickFallback();
    }

    return new Response(JSON.stringify({ topic, source: "ai", level: userLevel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-unscripted-topic error", e);
    const fb = FALLBACK_TOPICS["A1"];
    return new Response(JSON.stringify({ topic: fb[Math.floor(Math.random() * fb.length)], source: "fallback-error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

});