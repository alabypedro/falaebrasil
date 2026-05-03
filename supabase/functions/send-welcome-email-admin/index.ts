import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://falaebrasil.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const admin = createClient(SUPABASE_URL, SERVICE);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdminData) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Email inválido" }, 400);
    }

    // Find user by email
    let foundId: string | null = null;
    let foundMeta: Record<string, any> = {};
    let page = 1;
    while (page <= 20 && !foundId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email);
      if (u) {
        foundId = u.id;
        foundMeta = u.user_metadata || {};
      }
      if (!data.users.length || data.users.length < 200) break;
      page++;
    }
    if (!foundId) return json({ error: "Usuário não encontrado com esse email" }, 404);

    // Make sure `from_hubla` flag is set so auth-email-hook serves the
    // branded welcome_purchase template instead of the generic recovery one.
    if (foundMeta.from_hubla !== true) {
      await admin.auth.admin.updateUserById(foundId, {
        user_metadata: { ...foundMeta, from_hubla: true },
      });
    }

    // Reset the one-shot guard so a new welcome email is allowed.
    await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("user_id", foundId);

    const redirectTo = `${APP_URL}/welcome?email=${encodeURIComponent(email)}`;
    const publicClient = createClient(SUPABASE_URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: resetErr } = await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (resetErr) {
      console.error("resetPasswordForEmail failed", resetErr);
      return json({ error: resetErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("send-welcome-email-admin error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}