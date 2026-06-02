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

    const { messages, type } = await req.json();

    const AZURE_OPENAI_KEY = Deno.env.get("AZURE_OPENAI_KEY");
    const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
    const AZURE_OPENAI_DEPLOYMENT = Deno.env.get("AZURE_OPENAI_DEPLOYMENT_NAME");

    if (!AZURE_OPENAI_KEY || !AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT) {
      throw new Error("Azure OpenAI configuration is missing");
    }

    const systemPrompt = type === 'listening' 
      ? "You are a TOEIC examiner focusing on listening comprehension. Your goal is to simulate a TOEIC Part 1 or Part 2 task. \n\n" +
        "CRITICAL: ALL your output must be EXCLUSIVELY in English. Do not use Portuguese at all.\n\n" +
        "1. Start by providing a short listening stimulus in English (a sentence or a short description of an image).\n" +
        "2. Then ask a multiple choice question (A, B, C) in English about it.\n" +
        "3. Wait for the user to respond.\n" +
        "4. Provide feedback on their answer and explain why it is correct or incorrect EXCLUSIVELY in English.\n\n" +
        "Keep the conversation flow natural and professional. Always encourage the user to listen carefully."
      : "You are an official English proficiency examiner (TOEIC/CEFR standard). The student has been assigned to write a storytelling or essay based on a photo or theme. Analyze the text sent by the student and always return a structured feedback in English containing: General Score (0-100), Grammatical Errors (with correction and explanation in English), Vocabulary, and Suggestion for Improvement. Continue the conversation in English encouraging the student to write more.";

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
          ...messages
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
