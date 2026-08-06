import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdminData) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Email inválido" }, 400);
    }

    let foundId: string | null = null;
    const { data: profileMatch } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();
    if (profileMatch?.user_id) foundId = profileMatch.user_id;

    let page = 1;
    while (page <= 20 && !foundId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email);
      if (u) foundId = u.id;
      if (!data.users.length || data.users.length < 200) break;
      page++;
    }

    if (!foundId) return jsonResponse({ error: "Usuário não encontrado com esse email" }, 404);

    const [{ data: profile }, { data: courseRows }, { data: bstRows }, { data: cats }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("display_name,plan_tier,has_course_access,subscription_status")
          .eq("user_id", foundId)
          .maybeSingle(),
        admin
          .from("user_course_access")
          .select("granted_at,source,courses(title,level,required_tier)")
          .eq("user_id", foundId),
        admin
          .from("bst_product_access")
          .select("granted_at,source,bst_products(title)")
          .eq("user_id", foundId),
        admin.from("student_categories").select("code").eq("user_id", foundId),
      ]);

    return jsonResponse({
      ok: true,
      user_id: foundId,
      email,
      display_name: profile?.display_name ?? null,
      plan_tier: profile?.plan_tier ?? null,
      subscription_status: profile?.subscription_status ?? null,
      has_course_access: profile?.has_course_access ?? false,
      categories: (cats ?? []).map((c: { code: string }) => c.code),
      courses: (courseRows ?? []).map((r: Record<string, unknown>) => ({
        title: (r.courses as { title?: string } | null)?.title ?? "—",
        level: (r.courses as { level?: string } | null)?.level ?? null,
        source: r.source,
        granted_at: r.granted_at,
      })),
      bst_products: (bstRows ?? []).map((r: Record<string, unknown>) => ({
        title: (r.bst_products as { title?: string } | null)?.title ?? "—",
        source: r.source,
        granted_at: r.granted_at,
      })),
    });
  } catch (e) {
    console.error("lookup-access-admin error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
