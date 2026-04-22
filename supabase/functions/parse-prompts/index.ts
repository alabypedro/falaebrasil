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
    // ---- AUTH GUARD: admin-only ----
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
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const level = (formData.get("level") as string) || "A1";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let text: string;
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".pdf")) {
      // For PDF: extract raw text bytes (best-effort plain text extraction)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Simple PDF text extraction: find text between BT/ET blocks or stream content
      const rawText = new TextDecoder("latin1").decode(bytes);
      
      // Extract text from PDF streams - find text in parentheses after Tj/TJ operators
      const textParts: string[] = [];
      // Match text in parentheses that appears before text-showing operators
      const regex = /\(([^)]*)\)\s*Tj/g;
      let match;
      while ((match = regex.exec(rawText)) !== null) {
        const decoded = match[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\([()])/g, "$1");
        if (decoded.trim()) textParts.push(decoded.trim());
      }
      
      // Also try TJ arrays
      const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
      while ((match = tjArrayRegex.exec(rawText)) !== null) {
        const innerRegex = /\(([^)]*)\)/g;
        let innerMatch;
        const parts: string[] = [];
        while ((innerMatch = innerRegex.exec(match[1])) !== null) {
          parts.push(innerMatch[1]);
        }
        const joined = parts.join("").trim();
        if (joined) textParts.push(joined);
      }
      
      text = textParts.join("\n");
      
      if (!text.trim()) {
        // Fallback: try to find readable ASCII sequences
        const asciiText = rawText.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s{3,}/g, "\n");
        text = asciiText;
      }
    } else {
      text = await file.text();
    }

    // Split into sentences/paragraphs, filter empties
    const prompts = text
      .split(/\n+/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 10) // min length for a useful prompt
      .map((line: string) => ({ text: line, level }));

    return new Response(JSON.stringify({ prompts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[parse-prompts] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
