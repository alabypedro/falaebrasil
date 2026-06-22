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
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const admin = createClient(SUPABASE_URL, SERVICE);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const callerId = userData.user.id;

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdminData) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const accesses = (body.accesses ?? []) as string[];
    const grant = body.grant !== false; // default true

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Email inválido" }, 400);
    }
    const validAccesses = accesses.filter((a): a is AccessField =>
      (ACCESS_FIELDS as readonly string[]).includes(a)
    );
    if (validAccesses.length === 0) {
      return jsonResponse({ error: "Selecione ao menos um acesso." }, 400);
    }

    // Find user by email
    let foundId: string | null = null;

    // Try profiles table first (faster + works when email is stored there)
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

    if (!foundId) {
      const localPart = email.split("@")[0]?.replace(/[._-]+/g, "%") ?? "";
      const { data: suggestions } = localPart
        ? await admin
            .from("profiles")
            .select("email")
            .ilike("email", `%${localPart}%`)
            .not("email", "is", null)
            .limit(3)
        : { data: [] };
      const suggestionEmails = (suggestions ?? [])
        .map((p: { email: string | null }) => p.email)
        .filter(Boolean);
      return jsonResponse({
        ok: false,
        error: suggestionEmails.length
          ? `Usuário não encontrado com esse email. Você quis dizer: ${suggestionEmails.join(", ")}?`
          : "Usuário não encontrado com esse email",
      });
    }

    const updates: Record<string, boolean> = {};
    for (const f of validAccesses) updates[f] = grant;

    const { error: upErr } = await admin
      .from("profiles")
      .update(updates)
      .eq("user_id", foundId);
    if (upErr) throw upErr;

    return jsonResponse({ ok: true, applied: updates });
  } catch (e) {
    console.error("grant-access-admin error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});