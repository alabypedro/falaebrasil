import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD ----
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
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { scores, transcription, referenceText, mode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a pronunciation coach for English learners (Brazilian Portuguese speakers). Analyze the following pronunciation assessment and provide SPECIFIC, actionable feedback in Brazilian Portuguese.

Reference text (what the user should have said):
"${referenceText || "(fala livre)"}"

What was recognized (what the user actually said):
"${transcription || "(nada reconhecido)"}"

Scores (0-100):
- Pronúncia (accuracy): ${scores?.pronunciation ?? 0}
- Fluência: ${scores?.fluency ?? 0}
- Gramática/Completude: ${scores?.grammar ?? 0}
- Vocabulário/Prosódia: ${scores?.vocabulary ?? 0}

Mode: ${mode === "scripted" ? "Leitura de texto (scripted)" : "Fala livre (unscripted)"}

Instructions:
- If the transcription is empty or just punctuation (like "."), it means the audio was NOT recognized. Say that clearly and suggest speaking louder/closer to the mic.
- If the transcription differs significantly from the reference, point out SPECIFIC words that were missed, mispronounced, or added.
- For low pronunciation scores, mention specific English sounds that are hard for Brazilian speakers (th, r, l, w/v, vowel differences).
- For low fluency, mention if they paused too much, spoke too slowly, or had unnatural rhythm.
- For low grammar/completeness, mention which parts of the reference text were skipped.
- For high scores (>80), praise specific aspects and give minor tips.
- Be encouraging but honest.

Return a JSON object with:
{
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "summary": "A brief one-line overall assessment"
}

Return 3-5 suggestions. Each should be specific and actionable, not generic.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { suggestions: ["Não foi possível gerar feedback detalhado. Tente novamente."], summary: "" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feedback error:", error);
    return new Response(JSON.stringify({ 
      suggestions: ["Erro ao gerar feedback. Tente gravar novamente."],
      summary: "Erro no processamento" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
