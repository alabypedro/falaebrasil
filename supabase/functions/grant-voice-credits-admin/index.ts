import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
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
    const callerEmail = userData.user.email ?? undefined;

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
    const email = String(body.email ?? "").trim().toLowerCase();
    const scripted = Math.max(0, Math.floor(Number(body.scripted_seconds ?? 0)));
    const unscripted = Math.max(0, Math.floor(Number(body.unscripted_seconds ?? 0)));

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (scripted === 0 && unscripted === 0) {
      return new Response(JSON.stringify({ error: "Informe ao menos um valor de créditos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user by email
    let foundId: string | null = null;
    let page = 1;
    while (page <= 20 && !foundId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email);
      if (u) foundId = u.id;
      if (!data.users.length || data.users.length < 200) break;
      page++;
    }

    if (!foundId) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado com esse email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read current balances
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("scripted_balance, unscripted_balance")
      .eq("user_id", foundId)
      .single();
    if (pErr) throw pErr;

    const newScripted = (profile?.scripted_balance ?? 0) + scripted;
    const newUnscripted = (profile?.unscripted_balance ?? 0) + unscripted;

    const { error: upErr } = await admin
      .from("profiles")
      .update({
        scripted_balance: newScripted,
        unscripted_balance: newUnscripted,
      })
      .eq("user_id", foundId);
    if (upErr) throw upErr;

    // Log grant for audit (idempotency key uses timestamp + admin id)
    const grantEventId = `manual-${callerId}-${Date.now()}`;
    await admin.from("voice_credit_grants").insert({
      user_id: foundId,
      hubla_event_id: grantEventId,
      hubla_product_id: "MANUAL_ADMIN_GRANT",
      scripted_seconds_added: scripted,
      unscripted_seconds_added: unscripted,
      raw_payload: {
        granted_by_admin: callerId,
        granted_by_email: callerEmail,
        target_email: email,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        new_scripted_balance: newScripted,
        new_unscripted_balance: newUnscripted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("grant-voice-credits-admin error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});