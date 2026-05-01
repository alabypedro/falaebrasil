import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hubla-token, x-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUBLA_SECRET = Deno.env.get("HUBLA_WEBHOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function extractEmail(body: any): string | null {
  return (
    body?.event?.userEmail ||
    body?.event?.user?.email ||
    body?.user?.email ||
    body?.customer?.email ||
    body?.email ||
    null
  );
}

function extractName(body: any): string {
  return (
    body?.event?.userName ||
    body?.event?.user?.name ||
    body?.user?.firstName ||
    body?.customer?.name ||
    body?.name ||
    "Aluno"
  );
}

function extractCustomerId(body: any): string | null {
  return (
    body?.event?.userId ||
    body?.event?.user?.id ||
    body?.user?.id ||
    body?.customer?.id ||
    null
  );
}

function extractProductIds(body: any): string[] {
  const ids = new Set<string>();
  const candidates = [
    body?.event?.productId,
    body?.event?.product?.id,
    body?.product?.id,
    body?.productId,
  ];
  for (const c of candidates) if (c) ids.add(String(c));
  const items = body?.event?.items ?? body?.items ?? body?.products ?? [];
  if (Array.isArray(items)) {
    for (const it of items) {
      const id = it?.productId ?? it?.id ?? it?.product?.id;
      if (id) ids.add(String(id));
    }
  }
  return Array.from(ids);
}

function extractEventId(body: any): string {
  return String(
    body?.id ||
    body?.event?.id ||
    body?.event_id ||
    body?.eventId ||
    body?.transactionId ||
    body?.event?.transactionId ||
    crypto.randomUUID()
  );
}

function extractProductNames(body: any): string[] {
  const names = new Set<string>();
  const candidates = [
    body?.event?.productName,
    body?.event?.product?.name,
    body?.product?.name,
    body?.productName,
  ];
  for (const c of candidates) if (c) names.add(String(c).toLowerCase());
  const items = body?.event?.items ?? body?.items ?? body?.products ?? [];
  if (Array.isArray(items)) {
    for (const it of items) {
      const n = it?.productName ?? it?.name ?? it?.product?.name;
      if (n) names.add(String(n).toLowerCase());
    }
  }
  return Array.from(names);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Validate Hubla signature/secret. Hubla typically sends an `X-Hubla-Token` header.
    if (HUBLA_SECRET) {
      const provided =
        req.headers.get("x-hubla-token") ||
        req.headers.get("x-signature") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";
      if (provided !== HUBLA_SECRET) {
        return new Response(JSON.stringify({ error: "invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const eventType: string =
      body?.type || body?.event?.type || body?.event_type || "unknown";

    // Only process successful purchase events
    const isPurchase =
      /sale|purchase|order|payment/i.test(eventType) &&
      !/refund|cancel|chargeback/i.test(eventType);

    if (!isPurchase) {
      return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = extractEmail(body);
    if (!email) {
      return new Response(JSON.stringify({ error: "missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = extractCustomerId(body);
    const fullName = extractName(body);
    const productIds = extractProductIds(body);
    const productNames = extractProductNames(body);

    // Look up product mapping
    const { data: mappings, error: mapErr } = await admin
      .from("hubla_product_mapping")
      .select("*");
    if (mapErr) throw mapErr;

    const matched = (mappings || []).filter((m: any) => {
      if (m.hubla_product_id && productIds.includes(String(m.hubla_product_id))) return true;
      if (
        m.hubla_product_name &&
        productNames.includes(String(m.hubla_product_name).toLowerCase())
      ) return true;
      // Fallback: match by display_name
      if (productNames.includes(String(m.display_name).toLowerCase())) return true;
      return false;
    });

    if (matched.length === 0) {
      console.warn("No product matched", { productIds, productNames });
      return new Response(
        JSON.stringify({ ok: true, warning: "no product matched", productIds, productNames }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate access flags
    const grants = {
      has_course_access: matched.some((m: any) => m.grants_course),
      has_ebook1_access: matched.some((m: any) => m.grants_ebook1),
      has_ebook2_access: matched.some((m: any) => m.grants_ebook2),
      has_ebook3_access: matched.some((m: any) => m.grants_ebook3),
    };

    // Find or create user by email
    let userId: string | null = null;
    let createdNewUser = false;

    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { full_name: fullName, from_hubla: true },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
      createdNewUser = true;
    }

    // Update profile with access flags + customer id (merge, only set true → never demote)
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("has_course_access, has_ebook1_access, has_ebook2_access, has_ebook3_access")
      .eq("user_id", userId!)
      .maybeSingle();

    const merged = {
      has_course_access: grants.has_course_access || currentProfile?.has_course_access || false,
      has_ebook1_access: grants.has_ebook1_access || currentProfile?.has_ebook1_access || false,
      has_ebook2_access: grants.has_ebook2_access || currentProfile?.has_ebook2_access || false,
      has_ebook3_access: grants.has_ebook3_access || currentProfile?.has_ebook3_access || false,
      hubla_customer_id: customerId ?? undefined,
    };

    const { error: updErr } = await admin
      .from("profiles")
      .update(merged)
      .eq("user_id", userId!);
    if (updErr) throw updErr;

    // ---- VOICE CREDIT GRANTS (idempotent per event+product) ----
    const eventId = extractEventId(body);
    const creditResults: any[] = [];
    for (const productId of productIds) {
      const { data: grantResult, error: grantErr } = await admin.rpc("grant_voice_credits", {
        _user_id: userId!,
        _hubla_event_id: eventId,
        _hubla_product_id: productId,
        _raw_payload: body,
      });
      if (grantErr) {
        console.error("grant_voice_credits failed", { productId, eventId, grantErr });
        creditResults.push({ productId, error: grantErr.message });
      } else {
        creditResults.push({ productId, ...grantResult });
      }
    }

    // Send recovery link if new user (so they can set their password)
    let recoveryLink: string | null = null;
    if (createdNewUser) {
      // Always redirect new students to the /auth page with their email pre-filled.
      // The frontend detects ?email=... and shows the "create password" form
      // with the email field locked (readOnly).
      const APP_URL = "https://falaebrasil.lovable.app";
      const redirectTo = `${APP_URL}/auth?email=${encodeURIComponent(email)}`;
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      recoveryLink = linkData?.properties?.action_link ?? null;
      // The auth-email-hook intercepts this and sends the branded
      // "welcome_purchase" template (single source of truth for the welcome email).
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        created_new_user: createdNewUser,
        granted: grants,
        matched_products: matched.map((m: any) => m.product_key),
        recovery_link_sent: createdNewUser,
        voice_credits: creditResults,
        event_id: eventId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("hubla-webhook error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});