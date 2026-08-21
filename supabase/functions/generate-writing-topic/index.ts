import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_TOPICS: Record<string, string[]> = {
  'A1': [
    "Escreva um texto curto se apresentando: nome, idade e de onde você é, em inglês.",
    "Descreva seu objeto favorito do seu quarto usando frases simples, em inglês.",
    "Escreva três frases sobre o que você faz toda manhã, em inglês.",
    "Descreva seu melhor amigo usando três adjetivos simples, em inglês.",
  ],
  'A2': [
    "Escreva um e-mail curto convidando um colega para uma reunião na próxima terça-feira, em inglês.",
    "Descreva seu último fim de semana: o que você fez e com quem estava, em inglês.",
    "Escreva sobre sua comida favorita e explique como fazer uma versão simples dela, em inglês.",
    "Descreva seu trabalho atual e suas principais tarefas diárias, em inglês.",
  ],
  'B1': [
    "Explique um atraso de projeto para um cliente por e-mail e sugira um novo prazo, em inglês.",
    "Escreva um parágrafo sobre seus objetivos de carreira para os próximos dois anos, em inglês.",
    "Descreva um desafio profissional que você superou recentemente e o que aprendeu, em inglês.",
    "Escreva uma resenha de um filme ou livro que você gostou recentemente, explicando o motivo, em inglês.",
  ],
  'B2': [
    "Escreva um texto argumentativo sobre as vantagens e desvantagens do trabalho remoto, em inglês.",
    "Descreva um plano detalhado para um novo negócio ou projeto comunitário, em inglês.",
    "Escreva uma carta formal de reclamação sobre um produto ou serviço que você recebeu, em inglês.",
    "Explique seu ponto de vista sobre uma questão ambiental atual em detalhes, em inglês.",
  ],
  'C1': [
    "Escreva uma análise sofisticada de uma questão social ou política complexa, em inglês.",
    "Descreva uma experiência pessoal com nuances usando vocabulário e estruturas avançadas, em inglês.",
    "Escreva uma proposta formal para uma mudança de estratégia corporativa, em inglês.",
    "Discuta o impacto da tecnologia nas relações humanas usando conceitos abstratos, em inglês.",
  ],
  'T1': [
    "Escreva três frases sobre você e sua escola, em inglês.",
    "Descreva seu jogo ou série favorita com frases simples, em inglês.",
  ],
  'T2': [
    "Conte o que você fez no último fim de semana, em inglês.",
    "Descreva sua rotina na escola e um plano para as férias, em inglês.",
  ],
  'T3': [
    "Escreva sua opinião sobre redes sociais para adolescentes, em inglês.",
    "Conte uma experiência marcante e o que você aprendeu, em inglês.",
  ],
  'T4': [
    "Escreva um texto curto defendendo uma opinião sobre esportes na escola, em inglês.",
    "Descreva um projeto que você gostaria de criar com seus amigos, em inglês.",
  ],
  'K1': [
    "Escreva três frases curtas sobre suas cores favoritas, em inglês.",
    "Escreva os nomes de cinco animais e uma frase sobre cada, em inglês.",
  ],
  'K2': [
    "Escreva quatro frases sobre sua família, em inglês.",
    "Descreva seu brinquedo favorito com frases curtas, em inglês.",
  ],
  'K3': [
    "Conte o que você faz depois da escola, em inglês.",
    "Escreva sobre seu dia favorito da semana, em inglês.",
  ],
  'K4': [
    "Escreva um pequeno parágrafo sobre suas férias, em inglês.",
    "Descreva seu melhor amigo e o que vocês gostam de fazer, em inglês.",
  ],
  'C2': [
    "Escreva um ensaio magistralmente estruturado resumindo pontos de vista contrastantes sobre um tópico filosófico, em inglês.",
    "Produza um relatório altamente técnico sobre um assunto especializado de sua escolha, em inglês.",
    "Escreva uma peça criativa usando expressões idiomáticas complexas e metáforas, em inglês.",
    "Avalie criticamente uma obra literária ou pesquisa acadêmica com absoluta precisão, em inglês.",
  ]
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
      const ALLOWED_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "T1", "T2", "T3", "T4", "K1", "K2", "K3", "K4"];
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
      .single();

    const userLevel = requestedLevel || profile?.level || "A1";
    const levelFallbacks = FALLBACK_TOPICS[userLevel as keyof typeof FALLBACK_TOPICS] || FALLBACK_TOPICS['A1'];

    if (!LOVABLE_API_KEY) {
      const fallback = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você gera UM tema de prática de escrita para alunos brasileiros aprendendo inglês.
Nível atual do aluno: ${userLevel}.

REGRAS:
- Responda SEMPRE em PORTUGUÊS DO BRASIL (a enunciação do tema).
- Alterne entre situações do COTIDIANO e PROFISSIONAIS.
- Frequentemente peça para o aluno escrever um e-mail curto e objetivo (profissional, convite, feedback, etc.).
- O tema deve ser adequado ao nível do aluno (${userLevel}).
- Frase curta (máx. 20 palavras), começando com verbo no imperativo (Escreva, Descreva, Conte, Explique).
- Termine com "em inglês.".
- NÃO use aspas, emojis, listas, markdown ou explicações. Apenas a enunciação.
- Evite repetir temas recentes.`;

    const userPrompt = recent.length
      ? `Gere um novo tema de escrita em português diferente destes recentes: ${recent.map((r) => `"${r}"`).join(", ")}`
      : `Gere um tema de prática de escrita adequado ao nível ${userLevel}.`;

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

    if (!aiResp.ok) {
      const fallback = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback-api-error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    let topic: string = aiData?.choices?.[0]?.message?.content ?? "";
    topic = topic.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
    
    if (!topic || topic.length > 280) {
      topic = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];
    }

    return new Response(JSON.stringify({ topic, source: "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-writing-topic error", e);
    const fallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
    return new Response(JSON.stringify({ topic: fallback, source: "fallback-error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
