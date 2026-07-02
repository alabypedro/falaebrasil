import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: userData } = await admin.auth.getUser(authHeader.slice(7));
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const scope = String(body.scope ?? "all"); // "all" | "deck"
    const deck_id = body.deck_id ? String(body.deck_id) : null;
    if (!email) return json({ error: "Email obrigatório" }, 400);
    if (scope === "deck" && !deck_id) return json({ error: "deck_id obrigatório" }, 400);

    const { data: profile } = await admin
      .from("profiles").select("user_id").ilike("email", email).maybeSingle();
    let userId = profile?.user_id as string | undefined;

    if (!userId) {
      // fallback: scan auth users
      let page = 1;
      while (page <= 20 && !userId) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const u = data?.users?.find((x) => (x.email ?? "").toLowerCase() === email);
        if (u) userId = u.id;
        if (!data?.users?.length || data.users.length < 200) break;
        page++;
      }
    }
    if (!userId) return json({ error: "Usuário não encontrado com esse email" }, 404);

    let query = admin.from("user_card_reviews").delete().eq("user_id", userId);
    if (scope === "deck" && deck_id) {
      const { data: cards } = await admin.from("memorize_cards").select("id").eq("deck_id", deck_id);
      const ids = (cards ?? []).map((c: any) => c.id);
      if (ids.length === 0) return json({ ok: true, deleted: 0 });
      query = query.in("card_id", ids);
    }
    const { data: deleted, error } = await query.select("id");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, deleted: deleted?.length ?? 0 });
  } catch (e) {
    console.error("memorizae-reset-review error", e);
    return json({ error: (e as Error).message }, 500);
  }
});