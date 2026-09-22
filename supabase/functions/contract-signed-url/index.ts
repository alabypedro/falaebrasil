import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE) return json({ error: "Server configuration error" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.slice("Bearer ".length).trim(),
    );
    const userId = userData?.user?.id;
    if (userErr || !userId) return json({ error: "Unauthorized" }, 401);

    let contractId = "";
    try {
      const body = await req.json();
      contractId = typeof body?.contractId === "string" ? body.contractId.trim() : "";
    } catch {
      return json({ error: "Invalid JSON in request body" }, 400);
    }
    if (!/^[0-9a-f-]{36}$/i.test(contractId)) return json({ error: "Invalid request" }, 400);

    // Resolve the contract server-side — the client never supplies a storage path.
    const { data: contract } = await admin
      .from("contracts")
      .select("tier, file_path")
      .eq("id", contractId)
      .maybeSingle();
    if (!contract?.file_path) return json({ error: "Not found" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });

    if (!isAdmin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("plan_tier")
        .eq("user_id", userId)
        .maybeSingle();
      const tier = String(profile?.plan_tier ?? "").toLowerCase();
      if (!tier || tier !== String(contract.tier ?? "").toLowerCase()) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("contracts")
      .createSignedUrl(contract.file_path, 600);
    if (signErr || !signed?.signedUrl) return json({ error: "Could not open contract" }, 500);

    return json({ url: signed.signedUrl });
  } catch (e) {
    console.error("contract-signed-url error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
