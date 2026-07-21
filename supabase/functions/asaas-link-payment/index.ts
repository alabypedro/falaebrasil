import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const getEnv = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

const isSandbox = getEnv("ASAAS_ENV") === "sandbox";
const ASAAS_BASE_URL = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
const ASAAS_API_KEY = isSandbox ? getEnv("ASAAS_API_KEY_SANDBOX") : getEnv("ASAAS_API_KEY");

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SERVICE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const ANON = getEnv("SUPABASE_ANON_KEY");

async function asaas(path: string) {
  return fetch(`${ASAAS_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require an authenticated admin caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const paymentId: string | undefined = body.asaas_payment_id?.trim();
    const email: string | undefined = body.user_email?.trim().toLowerCase();
    if (!paymentId || !email) return json({ error: "asaas_payment_id and user_email are required" }, 400);

    // Resolve target user by email
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, email")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) return json({ error: `No user found with email ${email}` }, 404);
    const targetUserId = profile.user_id;

    // Fetch payment from ASAAS
    const payResp = await asaas(`/payments/${paymentId}`);
    if (!payResp.ok) {
      const t = await payResp.text();
      return json({ error: `ASAAS payment fetch failed: ${payResp.status} ${t}` }, 400);
    }
    const payment = await payResp.json();
    const customerId = payment.customer as string;

    // Upsert customer link to target user
    let cpfCnpj: string | null = null;
    let phone: string | null = null;
    try {
      const custResp = await asaas(`/customers/${customerId}`);
      if (custResp.ok) {
        const cust = await custResp.json();
        cpfCnpj = (cust.cpfCnpj ?? "").replace(/\D/g, "") || null;
        phone = (cust.mobilePhone ?? cust.phone ?? "").replace(/\D/g, "") || null;
      }
    } catch (_) {
      /* ignore */
    }

    await admin
      .from("asaas_customers")
      .upsert(
        { user_id: targetUserId, asaas_customer_id: customerId, cpf_cnpj: cpfCnpj, phone },
        { onConflict: "user_id" },
      );
    await admin.from("profiles").update({ asaas_customer_id: customerId }).eq("user_id", targetUserId);

    // Upsert the payment row for this user
    await admin.from("asaas_payments").upsert(
      {
        asaas_payment_id: payment.id,
        user_id: targetUserId,
        asaas_subscription_id: payment.subscription?.id ?? payment.subscription ?? null,
        product_key: payment.description ?? null,
        status: payment.status,
        billing_type: payment.billingType,
        value_cents: Math.round((payment.value ?? 0) * 100),
        net_value_cents: payment.netValue ? Math.round(payment.netValue * 100) : null,
        due_date: payment.dueDate,
        paid_at: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : null,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl,
        raw_payload: payment,
      },
      { onConflict: "asaas_payment_id" },
    );

    // Resolve product_key
    const rawKey = (payment.description ?? "").trim();
    let productKey: string | null = null;
    if (rawKey) {
      const { data: exact } = await admin
        .from("payment_products")
        .select("product_key")
        .eq("product_key", rawKey)
        .eq("active", true)
        .maybeSingle();
      if (exact) productKey = exact.product_key;
      if (!productKey) {
        const { data: byName } = await admin
          .from("payment_products")
          .select("product_key")
          .ilike("name", rawKey)
          .eq("active", true)
          .maybeSingle();
        if (byName) productKey = byName.product_key;
      }
    }

    // Static ASAAS payment links may arrive without description. Match by the
    // paymentLink id inside the checkout_url configured in Admin > Pagamentos.
    if (!productKey) {
      const paymentLinkId = (payment.paymentLink ?? payment.paymentLinkId ?? "").trim();
      if (paymentLinkId) {
        const { data: byCheckoutUrl } = await admin
          .from("payment_products")
          .select("product_key")
          .ilike("checkout_url", `%${paymentLinkId}%`)
          .eq("active", true)
          .maybeSingle();
        if (byCheckoutUrl) productKey = byCheckoutUrl.product_key;
      }
    }

    let grantResult: any = null;
    const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status);
    if (productKey && isPaid) {
      const { data, error } = await admin.rpc("grant_access_from_asaas", {
        _user_id: targetUserId,
        _asaas_payment_id: payment.id,
        _product_key: productKey,
        _raw: payment,
      });
      if (error) return json({ error: `grant_access failed: ${error.message}` }, 500);
      grantResult = data;
    }

    return json({
      ok: true,
      linked_user_id: targetUserId,
      linked_email: profile.email,
      customer_id: customerId,
      payment_status: payment.status,
      product_key: productKey,
      access_granted: !!grantResult,
      reason: !productKey
        ? "product_key_not_found"
        : !isPaid
          ? "payment_not_paid_yet"
          : "granted",
    });
  } catch (e) {
    console.error("asaas-link-payment error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}