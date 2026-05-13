import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACCESS_FIELDS = [
  "has_course_access",
  "has_a2_access",
  "has_b1_access",
  "has_b2_access",
  "has_ebook1_access",
  "has_ebook2_access",
  "has_ebook3_access",
] as const;

type AccessField = typeof ACCESS_FIELDS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const accesses = (body.accesses ?? []) as string[];
    const grant = body.grant !== false;

    const validAccesses = accesses.filter((a): a is AccessField =>
      (ACCESS_FIELDS as readonly string[]).includes(a)
    );
    if (validAccesses.length === 0) {
      return new Response(JSON.stringify({ error: "Selecione ao menos um acesso." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, boolean> = {};
    for (const f of validAccesses) updates[f] = grant;

    // Update ALL profiles
    const { error: upErr, count } = await admin
      .from("profiles")
      .update(updates, { count: "exact" })
      .not("user_id", "is", null);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ ok: true, applied: updates, affected: count ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("grant-access-bulk error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});