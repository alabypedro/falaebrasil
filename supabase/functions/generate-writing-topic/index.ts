import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_TOPICS = [
  "Write a short email inviting a colleague to a meeting.",
  "Describe your main responsibilities at your current job.",
  "Write a professional thank-you message after a job interview.",
  "Explain a project delay to a client via email.",
  "Write a paragraph about your career goals for the next two years.",
  "Ask for feedback on a presentation you just gave.",
  "Write a short email introducing yourself to a new business partner.",
  "Describe a professional challenge you recently overcame.",
];

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
      requestedLevel = body?.level;
    } catch (_) {
      // no body is fine
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("level")
      .eq("user_id", userData.user.id)
      .single();

    const userLevel = requestedLevel || profile?.level || "A1";

    if (!LOVABLE_API_KEY) {
      const fallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You generate ONE English writing practice topic for students.
Current student level: ${userLevel}.

RULES:
- Respond ALWAYS in ENGLISH (the topic enunciation).
- Alternate between DAILY LIFE and PROFESSIONAL situations.
- Frequently ask the student to write a short and objective email (e.g., professional email, invitation, feedback, etc.).
- The topic must be appropriate for the student's level (${userLevel}).
- Short sentence (max 20 words), starting with an imperative verb (Write, Describe, Tell, Explain).
- Ends with "in English."
- DO NOT use quotes, emojis, lists, markdown, or explanations. Just the enunciation.
- Avoid repeating recent topics.`;

    const userPrompt = recent.length
      ? `Gere um novo tema de escrita diferente destes recentes: ${recent.map((r) => `"${r}"`).join(", ")}`
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
      const fallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback-api-error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let topic: string = data?.choices?.[0]?.message?.content ?? "";
    topic = topic.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
    
    if (!topic || topic.length > 250) {
      topic = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
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
