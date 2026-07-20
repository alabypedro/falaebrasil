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
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { text, source = "en", target = "pt-BR" } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return json({ error: "Texto obrigatório" }, 400);
    }
    if (text.length > 2000) {
      return json({ error: "Texto muito longo (máx. 2000 caracteres)" }, 400);
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um tradutor. Traduza do ${source} para ${target}. Responda APENAS com a tradução, sem aspas, sem explicações, sem prefixos.`,
          },
          { role: "user", content: text.trim() },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return json({ error: `AI error ${res.status}: ${t}` }, 500);
    }
    const data = await res.json();
    const translation = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return json({ translation });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});