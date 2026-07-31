import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { applyBstOnlyTier } from "../_shared/grants.ts";

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
    const courseIds = (Array.isArray(body.course_ids) ? body.course_ids : []).map((x: unknown) =>
      String(x)
    );
    const bstProductIds = (Array.isArray(body.bst_product_ids) ? body.bst_product_ids : []).map(
      (x: unknown) => String(x),
    );
    const grant = body.grant !== false;

    const validAccesses = accesses.filter((a): a is AccessField =>
      (ACCESS_FIELDS as readonly string[]).includes(a)
    );
    if (validAccesses.length === 0 && courseIds.length === 0 && bstProductIds.length === 0) {
      return new Response(JSON.stringify({ error: "Selecione ao menos um acesso." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, boolean> = {};
    for (const f of validAccesses) updates[f] = grant;
    if (courseIds.length > 0 && grant) updates.has_course_access = true;

    let count: number | null = null;
    if (Object.keys(updates).length > 0) {
      // Update ALL profiles
      const res = await admin
        .from("profiles")
        .update(updates, { count: "exact" })
        .not("user_id", "is", null);
      if (res.error) throw res.error;
      count = res.count ?? null;
    }

    // Course / BST product grants for every registered user
    if (grant && (courseIds.length > 0 || bstProductIds.length > 0)) {
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("user_id")
        .not("user_id", "is", null);
      if (pErr) throw pErr;
      const userIds = (profiles ?? []).map((p: { user_id: string }) => p.user_id);
      count = count ?? userIds.length;

      const chunk = <T,>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );

      if (courseIds.length > 0) {
        const rows = userIds.flatMap((user_id: string) =>
          courseIds.map((course_id) => ({ user_id, course_id, source: "admin" }))
        );
        for (const part of chunk(rows, 500)) {
          const { error } = await admin
            .from("user_course_access")
            .upsert(part, { onConflict: "user_id,course_id" });
          if (error) throw error;
        }
      }

      if (bstProductIds.length > 0) {
        const rows = userIds.flatMap((user_id: string) =>
          bstProductIds.map((product_id) => ({ user_id, product_id, source: "admin" }))
        );
        for (const part of chunk(rows, 500)) {
          const { error } = await admin
            .from("bst_product_access")
            .upsert(part, { onConflict: "user_id,product_id" });
          if (error) throw error;
        }
        if (courseIds.length === 0) {
          for (const uid of userIds) await applyBstOnlyTier(admin, uid);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        applied: updates,
        affected: count,
        courses_granted: courseIds.length,
        bst_products_granted: bstProductIds.length,
      }),
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