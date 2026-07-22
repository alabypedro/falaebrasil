import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = "https://app.falaebrasil.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, checkout_url } = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
    const steps: any[] = [];

    // 1) Resolve product by checkout_url
    const paymentLinkId = (checkout_url || "").split("/").pop();
    const { data: product } = await admin
      .from("payment_products")
      .select("*")
      .ilike("checkout_url", `%${paymentLinkId}%`)
      .maybeSingle();
    if (!product) return json({ error: "product_not_found", paymentLinkId }, 404);
    steps.push({ step: "resolve_product", product_key: product.product_key, name: product.name });

    // 2) Find or create user by email
    let userId: string | null = null;
    let created = false;
    const { data: profileRow } = await admin.from("profiles").select("user_id").ilike("email", email).maybeSingle();
    if (profileRow?.user_id) userId = profileRow.user_id;
    if (!userId) {
      const { data: cr, error: ce } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { from_hubla: true },
      });
      if (ce) return json({ error: "create_user_failed", detail: ce.message }, 500);
      userId = cr.user!.id;
      created = true;
    }
    steps.push({ step: "user", user_id: userId, created });

    // 3) Grant access via same RPC used by real webhook
    const fakePaymentId = `sim_${crypto.randomUUID()}`;
    const { data: grant, error: gErr } = await admin.rpc("grant_access_from_asaas", {
      _user_id: userId,
      _asaas_payment_id: fakePaymentId,
      _product_key: product.product_key,
      _raw: { simulated: true, email, checkout_url },
    });
    if (gErr) return json({ error: "grant_failed", detail: gErr.message, steps }, 500);
    steps.push({ step: "grant_access", grant });

    // 4) Ensure flag + send welcome_purchase email via password reset flow
    const { data: uRes } = await admin.auth.admin.getUserById(userId);
    const meta = uRes?.user?.user_metadata || {};
    if (meta.from_hubla !== true) {
      await admin.auth.admin.updateUserById(userId, { user_metadata: { ...meta, from_hubla: true } });
    }
    const publicClient = createClient(SUPABASE_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
    const redirectTo = `${APP_URL}/welcome?email=${encodeURIComponent(email)}`;
    const { error: rErr } = await publicClient.auth.resetPasswordForEmail(email, { redirectTo });
    steps.push({ step: "send_welcome_email", ok: !rErr, error: rErr?.message ?? null, note: uRes?.user?.last_sign_in_at ? "user already signed in before; branded welcome may not trigger" : "first-time buyer" });

    return json({ ok: true, steps });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}