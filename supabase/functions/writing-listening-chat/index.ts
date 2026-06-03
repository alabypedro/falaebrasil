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
      'A1': 'Focus on basic vocabulary, correct use of "to be", present simple, and ability to introduce yourself or describe simple objects.',
      'A2': 'Focus on past simple, future with "going to", comparative adjectives, and describing everyday tasks or personal background.',
      'B1': 'Focus on present perfect, conditional sentences (type 1), relative clauses, and expressing opinions or ambitions.',
      'B2': 'Focus on passive voice, all conditionals, modal verbs in the past, and ability to argue a point or explain detailed viewpoints.',
      'C1': 'Focus on inversion, mixed conditionals, advanced phrasal verbs, and subtle nuances in formal and informal contexts.',
      'C2': 'Focus on mastery of complex structures, idiomatic expressions, and ability to summarize information from different sources coherently.'
    };

    const systemPrompt = type === 'listening' 
      ? `You are a TOEIC examiner focusing on listening comprehension. Your goal is to simulate a TOEIC Part 1 or Part 2 task at the ${level || 'A1'} CEFR level. \n\n` +
        "CRITICAL: ALL your output must be EXCLUSIVELY in English. Do not use Portuguese at all.\n\n" +
        "1. Start by providing a short listening stimulus in English (a sentence or a short description of an image).\n" +
        "2. Then ask a multiple choice question (A, B, C) in English about it.\n" +
        "3. Wait for the user to respond.\n" +
        "4. Provide feedback on their answer and explain why it is correct or incorrect EXCLUSIVELY in English.\n\n" +
        "Keep the conversation flow natural and professional. Always encourage the user to listen carefully."
      : `You are an official English proficiency examiner (TOEIC/CEFR standard). The student's current target level is ${level || 'A1'}. Analyze the text sent by the student and always return a structured feedback in English containing: 
         - General Score (0-100)
         - Grammatical Errors (with correction and explanation in English). 
           IMPORTANT: Identify every single grammar mistake.
         - Vocabulary Analysis (appropriate for level ${level || 'A1'})
         - CEFR Level Evaluation (how close their writing is to the target ${level || 'A1'} level)
         - CEFR Criteria Applied: ${cefrCriteria[level as keyof typeof cefrCriteria] || cefrCriteria['A1']}
         - Suggestion for Improvement (Specific points to improve to reach or master ${level || 'A1'}). 
         
         CRITICAL: If the student makes any clear grammar or vocabulary mistake, list it under 'Grammatical Errors' in a way that can be easily parsed.
         
         Continue the conversation in English encouraging the student to write more.`;

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
