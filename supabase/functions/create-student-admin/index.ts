import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { applyBstOnlyTier } from "../_shared/grants.ts";

const ACCESS_FIELDS = [
  "has_course_access",
  "has_a2_access",
  "has_b1_access",
  "has_b2_access",
] as const;
type AccessField = typeof ACCESS_FIELDS[number];

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function genTempPassword(): string {
  // 12 chars: upper, lower, digit, symbol — meets Welcome page policy
  const upp = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const low = "abcdefghijkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*";
  const all = upp + low + num + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upp) + pick(low) + pick(num) + pick(sym);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const callerId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsError || !callerId) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdminData) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const password = String(body.password ?? "").trim() || genTempPassword();
    const accesses = (body.accesses ?? []) as string[];
    const courseIds = (Array.isArray(body.course_ids) ? body.course_ids : []).map((x: unknown) =>
      String(x)
    );
    const bstProductIds = (Array.isArray(body.bst_product_ids) ? body.bst_product_ids : []).map(
      (x: unknown) => String(x),
    );
    const planTier = body.plan_tier ? String(body.plan_tier) : null;
    const musicLab = body.music_lab !== false;
    const booksAccess = body.books_access !== false;
    const ALL_LEVELS = [
      "A1","A2","B1","B2","C1","C2","T1","T2","T3","T4","K1","K2","K3","K4",
    ];
    const allowedLevels = (Array.isArray(body.allowed_levels) ? body.allowed_levels : [])
      .map((x: unknown) => String(x).toUpperCase())
      .filter((x: string) => ALL_LEVELS.includes(x));
    const role = String(body.role ?? "student").toLowerCase() === "teacher" ? "teacher" : "student";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Email inválido" }, 400);
    }
    if (password.length < 8) return json({ error: "Senha muito curta (mín. 8)" }, 400);
    const validAccesses = accesses.filter((a): a is AccessField =>
      (ACCESS_FIELDS as readonly string[]).includes(a)
    );

    // Look up existing user
    let foundId: string | null = null;
    const { data: profileMatch } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();
    if (profileMatch?.user_id) foundId = profileMatch.user_id;

    if (!foundId) {
      let page = 1;
      while (page <= 20 && !foundId) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email);
        if (u) foundId = u.id;
        if (!data.users.length || data.users.length < 200) break;
        page++;
      }
    }

    let created = false;
    if (!foundId) {
      const { data: c, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: displayName || email.split("@")[0],
          name: displayName || email.split("@")[0],
          display_name: displayName || email.split("@")[0],
          created_by_admin: true,
        },
      });
      if (cErr || !c?.user?.id) {
        return json({ error: `Não foi possível criar: ${cErr?.message ?? "desconhecido"}` }, 400);
      }
      foundId = c.user.id;
      created = true;
    } else {
      // Existing user: reset password and confirm email
      const { error: upErr } = await admin.auth.admin.updateUserById(foundId, {
        password,
        email_confirm: true,
        user_metadata: displayName
          ? { full_name: displayName, name: displayName, display_name: displayName }
          : undefined,
      });
      if (upErr) return json({ error: `Não foi possível atualizar: ${upErr.message}` }, 400);
    }

    // Upsert profile (email + name)
    await admin.from("profiles").upsert(
      {
        user_id: foundId,
        email,
        ...(displayName ? { display_name: displayName } : {}),
      },
      { onConflict: "user_id" },
    );

    // Apply accesses
    const updates: Record<string, unknown> = {};
    for (const f of validAccesses) updates[f] = true;
    if (courseIds.length > 0) updates.has_course_access = true;
    // BST-only student (no courses) -> restricted "bst" segment, like the checkout flow
    const effectiveTier =
      bstProductIds.length > 0 && courseIds.length === 0 && (!planTier || planTier === "open")
        ? "bst"
        : planTier;
    if (effectiveTier && ["open", "pro", "vip", "kids", "teens", "bst"].includes(effectiveTier)) {
      updates.plan_tier = effectiveTier;
    }
    updates.has_books_access = booksAccess;
    updates.allowed_levels = allowedLevels.length > 0 ? allowedLevels : null;
    if (Object.keys(updates).length > 0) {
      const { error: pErr } = await admin.from("profiles").update(updates).eq("user_id", foundId);
      if (pErr) throw pErr;
    }

    // Grant individual course access
    if (courseIds.length > 0) {
      const { error: cErr } = await admin.from("user_course_access").upsert(
        courseIds.map((course_id) => ({ user_id: foundId, course_id, source: "admin" })),
        { onConflict: "user_id,course_id" },
      );
      if (cErr) throw cErr;
    }

    // Grant BST library product access
    if (bstProductIds.length > 0) {
      const { error: bErr } = await admin.from("bst_product_access").upsert(
        bstProductIds.map((product_id) => ({ user_id: foundId, product_id, source: "admin" })),
        { onConflict: "user_id,product_id" },
      );
      if (bErr) throw bErr;
    }

    // Cantaê (Music Lab)
    if (musicLab) {
      const { error: mErr } = await admin
        .from("music_lab_access")
        .upsert({ user_id: foundId, source: "admin" }, { onConflict: "user_id" });
      if (mErr) throw mErr;
    } else {
      await admin.from("music_lab_access").delete().eq("user_id", foundId);
    }

    if (effectiveTier === "bst") await applyBstOnlyTier(admin, foundId);

    // Papel do usuário: professor recebe a role `teacher` automaticamente.
    if (role === "teacher") {
      const { error: rErr } = await admin
        .from("user_roles")
        .upsert({ user_id: foundId, role: "teacher" }, { onConflict: "user_id,role" });
      if (rErr) throw rErr;
    }

    return json({
      ok: true,
      created,
      user_id: foundId,
      email,
      password,
      role,
      applied: updates,
      courses_granted: courseIds.length,
      bst_products_granted: bstProductIds.length,
    });
  } catch (e) {
    console.error("create-student-admin error", e);
    return json({ error: (e as Error).message }, 500);
  }
});