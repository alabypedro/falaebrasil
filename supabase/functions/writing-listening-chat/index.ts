import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, type, level, user_id } = await req.json();

    // Validate messages: only user/assistant roles, capped count and size.
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const MAX_MESSAGES = 20;
    const MAX_CONTENT_LEN = 2000;
    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Too many messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of messages) {
      if (!m || typeof m !== "object") continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (typeof m.content !== "string") continue;
      if (m.content.length > MAX_CONTENT_LEN) {
        return new Response(JSON.stringify({ error: "Message too long" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      safeMessages.push({ role: m.role, content: m.content });
    }

    const AZURE_OPENAI_KEY = Deno.env.get("AZURE_OPENAI_KEY");
    const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
    const AZURE_OPENAI_DEPLOYMENT = Deno.env.get("AZURE_OPENAI_DEPLOYMENT_NAME");

    if (!AZURE_OPENAI_KEY || !AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT) {
      throw new Error("Azure OpenAI configuration is missing");
    }

    const cefrCriteria = {
      'A1': 'Foque em vocabulário básico, uso correto do verbo "to be", present simple e capacidade de se apresentar ou descrever objetos simples.',
      'A2': 'Foque em past simple, futuro com "going to", adjetivos comparativos e descrição de tarefas cotidianas ou histórico pessoal.',
      'B1': 'Foque em present perfect, condicionais (tipo 1), orações relativas e expressão de opiniões e ambições.',
      'B2': 'Foque em voz passiva, todos os condicionais, modais no passado e argumentação ou explicação de pontos de vista detalhados.',
      'C1': 'Foque em inversão, condicionais mistos, phrasal verbs avançados e nuances sutis em contextos formais e informais.',
      'C2': 'Foque no domínio de estruturas complexas, expressões idiomáticas e capacidade de resumir informações de diferentes fontes de forma coerente.'
    };

    const systemPrompt = type === 'listening' 
      ? `You are a TOEIC examiner focusing on listening comprehension. Your goal is to simulate a TOEIC Part 1 or Part 2 task at the ${level || 'A1'} CEFR level. \n\n` +
        "CRITICAL: ALL your output must be EXCLUSIVELY in English. Do not use Portuguese at all.\n\n" +
        "1. Start by providing a short listening stimulus in English (a sentence or a short description of an image).\n" +
        "2. Then ask a multiple choice question (A, B, C) in English about it.\n" +
        "3. Wait for the user to respond.\n" +
        "4. Provide feedback on their answer and explain why it is correct or incorrect EXCLUSIVELY in English.\n\n" +
        "Keep the conversation flow natural and professional. Always encourage the user to listen carefully."
      : `Você é um examinador oficial de proficiência em inglês (padrão TOEIC/CEFR) avaliando um aluno brasileiro. O nível-alvo atual é ${level || 'A1'}.

CRÍTICO: Responda SEMPRE em PORTUGUÊS DO BRASIL (todo o feedback, títulos, explicações e dicas). Apenas exemplos e correções de frases em inglês devem aparecer em inglês, entre aspas.

NUNCA use markdown, asteriscos (**), sublinhados (__), nem caracteres de formatação. Escreva apenas texto puro.

Estruture a resposta EXATAMENTE neste formato, com cada seção iniciando em uma nova linha e o título terminando com dois pontos:

Pontuação Geral: <número de 0 a 100>/100

Erros Gramaticais:
- <erro 1 — mostre o trecho original em inglês entre aspas, a correção em inglês entre aspas e uma breve explicação em português>
- <erro 2 ...>
(Se não houver erros, escreva: - Nenhum erro relevante identificado.)

Análise de Vocabulário:
- <observação 1 sobre o vocabulário usado, adequado ao nível ${level || 'A1'}>
- <observação 2 ...>

Avaliação do Nível CEFR:
- <quão próximo o texto está do nível ${level || 'A1'}, em uma ou duas linhas>

Critérios CEFR Aplicados:
- ${cefrCriteria[level as keyof typeof cefrCriteria] || cefrCriteria['A1']}

Dicas de Melhoria:
- <dica prática 1 em português>
- <dica prática 2 em português>
- <dica prática 3 em português>

Finalize com uma frase curta de incentivo em português, convidando o aluno a continuar escrevendo. Não use emojis em excesso (no máximo 1).

Identifique TODOS os erros gramaticais ou de vocabulário relevantes.`;

    const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Azure OpenAI Error:", errorData);
      throw new Error(`Azure OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in writing-listening-chat:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
