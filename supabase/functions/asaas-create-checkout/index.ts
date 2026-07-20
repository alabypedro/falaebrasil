import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const getEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

const isSandbox = getEnv("ASAAS_ENV") === "sandbox";
const ASAAS_BASE_URL = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
const ASAAS_API_KEY = isSandbox ? getEnv("ASAAS_API_KEY_SANDBOX") : getEnv("ASAAS_API_KEY");

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SERVICE = getEnv("SUPABASE_SERVICE_ROLE_KEY");

function asaasHeaders() {
  return {
    "Content-Type": "application/json",
    "access_token": ASAAS_API_KEY,
  };
}

async function fetchAsaas(path: string, init?: RequestInit) {
  return fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: { ...asaasHeaders(), ...init?.headers },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await admin.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;
    const userEmail = claims.claims.email ?? "";

    const body = await req.json();
    const productKey = String(body.product_key ?? "").trim();
    const cpfCnpj = body.cpf_cnpj ? String(body.cpf_cnpj).replace(/\D/g, "") : null;
    const phone = body.phone ? String(body.phone).replace(/\D/g, "") : null;

    if (!productKey) {
      return new Response(JSON.stringify({ error: "product_key obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: product, error: productErr } = await admin
      .from("payment_products")
      .select("*")
      .eq("product_key", productKey)
      .eq("active", true)
      .maybeSingle();
    if (productErr) throw productErr;
    if (!product) {
      return new Response(JSON.stringify({ error: "Produto não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile for name
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, phone, asaas_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    const userName = profile?.display_name ?? userEmail.split("@")[0] ?? "Aluno";
    const userPhone = phone ?? profile?.phone ?? "";

    // ASAAS requires CPF/CNPJ to create charges
    const existingCpf = (profile as any)?.cpf_cnpj as string | undefined;
    const cpfToUse = cpfCnpj || (existingCpf ? existingCpf.replace(/\D/g, "") : null);
    if (!cpfToUse) {
      return new Response(
        JSON.stringify({ error: "CPF/CNPJ obrigatório para pagamentos em produção", needsCpf: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Reuse existing customer or create new
    let customerId = profile?.asaas_customer_id ?? null;
    if (!customerId) {
      const customerBody: any = {
        name: userName,
        email: userEmail,
        phone: userPhone || undefined,
        cpfCnpj: cpfToUse,
      };
      const customerResp = await fetchAsaas("/customers", {
        method: "POST",
        body: JSON.stringify(customerBody),
      });
      if (!customerResp.ok) {
        const txt = await customerResp.text();
        throw new Error(`Asaas customer creation failed: ${customerResp.status} ${txt}`);
      }
      const customer = await customerResp.json();
      customerId = customer.id;

      await admin.from("asaas_customers").upsert(
        {
          user_id: userId,
          asaas_customer_id: customerId,
          cpf_cnpj: cpfToUse,
          phone: userPhone,
        },
        { onConflict: "user_id" },
      );

      await admin
        .from("profiles")
        .update({ asaas_customer_id: customerId })
        .eq("user_id", userId);
    } else if (cpfCnpj) {
      // Update existing customer's CPF if it wasn't set before
      await fetchAsaas(`/customers/${customerId}`, {
        method: "POST",
        body: JSON.stringify({ cpfCnpj: cpfToUse, name: userName, email: userEmail }),
      });
    }

    // Create subscription or one-time payment
    let checkout: { invoiceUrl: string; id: string; subscription?: string };
    if (product.type === "subscription") {
      const today = new Date();
      const nextDueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const subResp = await fetchAsaas("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: product.price_cents / 100,
          nextDueDate,
          cycle: product.billing_cycle ?? "MONTHLY",
          description: product.product_key,
        }),
      });
      if (!subResp.ok) {
        const txt = await subResp.text();
        throw new Error(`Asaas subscription failed: ${subResp.status} ${txt}`);
      }
      const sub = await subResp.json();
      checkout = { invoiceUrl: sub.invoiceUrl, id: sub.id, subscription: sub.id };

      await admin.from("asaas_subscriptions").insert({
        user_id: userId,
        asaas_subscription_id: sub.id,
        product_key: product.product_key,
        status: sub.status,
        cycle: sub.cycle,
        value_cents: product.price_cents,
        next_due_date: sub.nextDueDate,
      });

      await admin
        .from("profiles")
        .update({ asaas_subscription_id: sub.id })
        .eq("user_id", userId);
    } else {
      const payResp = await fetchAsaas("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: product.price_cents / 100,
          dueDate: new Date().toISOString().slice(0, 10),
          description: product.product_key,
        }),
      });
      if (!payResp.ok) {
        const txt = await payResp.text();
        throw new Error(`Asaas payment failed: ${payResp.status} ${txt}`);
      }
      const pay = await payResp.json();
      checkout = { invoiceUrl: pay.invoiceUrl, id: pay.id };
    }

    return new Response(
      JSON.stringify({
        ok: true,
        invoice_url: checkout.invoiceUrl,
        payment_id: checkout.id,
        subscription_id: checkout.subscription,
        product_key: product.product_key,
        asaas_env: getEnv("ASAAS_ENV"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("asaas-create-checkout error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
