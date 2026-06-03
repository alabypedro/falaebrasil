import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_TOPICS: Record<string, string[]> = {
  'A1': [
    "Write a short text introducing yourself: name, age, and where you are from.",
    "Describe your favorite object in your room using simple sentences.",
    "Write three sentences about what you do every morning.",
    "Describe your best friend using three simple adjectives.",
  ],
  'A2': [
    "Write a short email inviting a colleague to a meeting next Tuesday.",
    "Describe your last weekend: what did you do and who were you with?",
    "Write about your favorite food and explain how to make a simple version of it.",
    "Describe your current job and your main daily tasks.",
  ],
  'B1': [
    "Explain a project delay to a client via email and suggest a new deadline.",
    "Write a paragraph about your career goals for the next two years.",
    "Describe a professional challenge you recently overcame and what you learned.",
    "Write a review of a movie or book you enjoyed recently, explaining why.",
  ],
  'B2': [
    "Write an argumentative text about the advantages and disadvantages of remote work.",
    "Describe a detailed plan for a new business or community project.",
    "Write a formal letter of complaint about a product or service you received.",
    "Explain your viewpoint on a current environmental issue in detail.",
  ],
  'C1': [
    "Write a sophisticated analysis of a complex social or political issue.",
    "Describe a nuanced personal experience using advanced vocabulary and structures.",
    "Write a formal proposal for a corporate strategy change.",
    "Discuss the impact of technology on human relationships using abstract concepts.",
  ],
  'C2': [
    "Write a masterfully structured essay summarizing contrasting viewpoints on a philosophical topic.",
    "Produce a highly technical report on a specialized subject of your choice.",
    "Write a creative piece using complex idiomatic expressions and metaphors.",
    "Critically evaluate a piece of literature or academic research with absolute precision.",
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
    const levelFallbacks = FALLBACK_TOPICS[userLevel as keyof typeof FALLBACK_TOPICS] || FALLBACK_TOPICS['A1'];

    if (!LOVABLE_API_KEY) {
      const fallback = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You generate ONE English writing practice topic for students.
Current student level: ${userLevel}.

LEVEL-SPECIFIC EXAMPLES:
- A1: "Introduce yourself to a new neighbor."
- A2: "Invite a friend to lunch via email."
- B1: "Explain a work problem to your boss."
- B2: "Debate the pros/cons of artificial intelligence."
- C1/C2: "Analyze the cultural impact of globalization."

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
      const fallback = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];
      return new Response(JSON.stringify({ topic: fallback, source: "fallback-api-error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    let topic: string = aiData?.choices?.[0]?.message?.content ?? "";
    topic = topic.trim().replace(/^["']|["']$/g, "").replace(/\n+/g, " ").trim();
    
    if (!topic || topic.length > 250) {
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
