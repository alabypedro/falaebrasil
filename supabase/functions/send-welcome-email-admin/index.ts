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

    // If the user doesn't exist yet, create them.
    if (!foundId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { from_hubla: true },
      });
      if (createErr || !created?.user?.id) {
        console.error("createUser failed in welcome-email-admin", createErr);
        return json({ error: createErr?.message ?? "Falha ao criar usuário" }, 500);
      }
      foundId = created.user.id;
      foundMeta = created.user.user_metadata || { from_hubla: true };
    }

    // Ensure `from_hubla` flag is set
    if (foundMeta.from_hubla !== true) {
      await admin.auth.admin.updateUserById(foundId, {
        user_metadata: { ...foundMeta, from_hubla: true },
      });
    }

    // ---- AUTO-GRANT PLANO OPEN IF NEW OR NO ACCESS ----
    // If the admin is forcing a welcome email, we should ensure they have the
    // baseline access (Plano OPEN) so they don't land on an empty dashboard.
    const { data: profile } = await admin
      .from("profiles")
      .select("has_course_access, scripted_balance")
      .eq("user_id", foundId)
      .single();

    if (!profile?.has_course_access) {
      console.log("Auto-granting Plano OPEN to manual onboardee", { email });
      
      // Grant basic access via profile
      await admin
        .from("profiles")
        .update({
          has_course_access: true,
          has_ebook1_access: true,
          has_ebook2_access: true,
          has_ebook3_access: true,
          plan_tier: "open",
          subscription_status: "active",
          scripted_balance: 1800,
          unscripted_balance: 1800,
        })
        .eq("user_id", foundId);

      // Grant A1-C2 courses
      const { data: openMapping } = await admin
        .from("hubla_product_mapping")
        .select("id")
        .eq("product_key", "essencial_pro_a1")
        .maybeSingle();

      if (openMapping) {
        const { data: courseLinks } = await admin
          .from("hubla_product_courses")
          .select("course_id")
          .eq("product_mapping_id", openMapping.id);
        
        if (courseLinks && courseLinks.length > 0) {
          const rows = courseLinks.map(c => ({
            user_id: foundId,
            course_id: c.course_id,
            source: "manual_admin"
          }));
          await admin.from("user_course_access").upsert(rows, { onConflict: "user_id,course_id" });
        }
      }
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