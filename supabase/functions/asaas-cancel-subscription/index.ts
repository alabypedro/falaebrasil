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

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const subscriptionId = String(body.subscription_id ?? "").trim();
    if (!subscriptionId) {
      return new Response(JSON.stringify({ error: "subscription_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetchAsaas(`/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Asaas cancel failed: ${resp.status} ${txt}`);
    }

    await admin
      .from("asaas_subscriptions")
      .update({ status: "CANCELED", canceled_at: new Date().toISOString() })
      .eq("asaas_subscription_id", subscriptionId);

    return new Response(JSON.stringify({ ok: true, subscription_id: subscriptionId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asaas-cancel-subscription error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
