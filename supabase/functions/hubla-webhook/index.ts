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
    body?.event?.invoice?.payer?.email ||
    body?.event?.userEmail ||
    body?.event?.user?.email ||
    body?.user?.email ||
    body?.customer?.email ||
    body?.email ||
    null
  );
}

function extractName(body: any): string {
  const payer = body?.event?.invoice?.payer;
  if (payer?.firstName || payer?.lastName) {
    return `${payer.firstName ?? ""} ${payer.lastName ?? ""}`.trim() || "Aluno";
  }
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
    body?.event?.invoice?.payerId ||
    body?.event?.invoice?.payer?.id ||
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
    body?.event?.invoice?.productId,
    body?.event?.invoice?.product?.id,
    body?.event?.offerId,
    body?.event?.offer?.id,
    body?.event?.invoice?.offerId,
    body?.event?.invoice?.offer?.id,
  ];
  for (const c of candidates) if (c) ids.add(String(c));
  const itemSources = [
    body?.event?.items,
    body?.event?.products,
    body?.event?.invoice?.items,
    body?.event?.invoice?.products,
    body?.event?.invoice?.offers,
    body?.event?.offers,
    body?.event?.orderBumps,
    body?.event?.invoice?.orderBumps,
    body?.items,
    body?.products,
  ];
  for (const items of itemSources) {
    if (Array.isArray(items)) {
      for (const it of items) {
        const id =
          it?.productId ?? it?.id ?? it?.product?.id ?? it?.offerId ?? it?.offer?.id;
        if (id) ids.add(String(id));
      }
    }
  }
  return Array.from(ids);
}

/**
 * Extract the PRIMARY product id of THIS specific invoice/event.
 *
 * Hubla emits one webhook per invoice (the main purchase + one extra invoice
 * per order bump, with ids like "<root>-offer-1"). Each of those events
 * also carries the FULL list of products bought together in `event.products`.
 *
 * If we credit voice seconds for every id in `event.products`, the same
 * product gets credited multiple times across the sibling invoices (e.g.
 * the course is credited by the main invoice AND by every order bump
 * invoice that re-lists it). To avoid this we only grant credits for the
 * single product this invoice actually represents.
 */
function extractPrimaryProductId(body: any): string | null {
  const candidates = [
    body?.event?.product?.id,
    body?.event?.productId,
    body?.event?.invoice?.product?.id,
    body?.event?.invoice?.productId,
    body?.event?.offer?.id,
    body?.event?.offerId,
    body?.product?.id,
    body?.productId,
  ];
  for (const c of candidates) if (c) return String(c);
  return null;
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

/**
 * Returns a stable id that is identical across all sibling webhooks of the
 * SAME purchase (main invoice + each order-bump invoice).
 *
 * Hubla emits one webhook per (invoice × product). For a single purchase it
 * generates a main invoice and one extra invoice per order bump, with ids
 * shaped like "<root>" and "<root>-offer-N". If we dedupe voice credits by
 * the per-webhook event id, the same product gets credited multiple times
 * (once per sibling invoice that re-lists it). Using the ROOT invoice id as
 * the dedupe key collapses all siblings of a purchase into one transaction
 * so each product is granted exactly once per purchase, while distinct
 * future purchases still get their own credits.
 */
function extractPurchaseDedupeId(body: any): string {
  const invoiceId =
    body?.event?.invoice?.id ||
    body?.event?.invoiceId ||
    body?.invoice?.id ||
    body?.invoiceId ||
    null;
  if (invoiceId) {
    return String(invoiceId).replace(/-offer-\d+$/i, "");
  }
  return extractEventId(body);
}

function extractProductNames(body: any): string[] {
  const names = new Set<string>();
  const candidates = [
    body?.event?.productName,
    body?.event?.product?.name,
    body?.product?.name,
    body?.productName,
    body?.event?.invoice?.productName,
    body?.event?.invoice?.product?.name,
    body?.event?.offerName,
    body?.event?.offer?.name,
  ];
  for (const c of candidates) if (c) names.add(String(c).toLowerCase());
  const itemSources = [
    body?.event?.items,
    body?.event?.products,
    body?.event?.invoice?.items,
    body?.event?.invoice?.products,
    body?.event?.invoice?.offers,
    body?.event?.offers,
    body?.event?.orderBumps,
    body?.event?.invoice?.orderBumps,
    body?.items,
    body?.products,
  ];
  for (const items of itemSources) {
    if (Array.isArray(items)) {
      for (const it of items) {
        const n =
          it?.productName ?? it?.name ?? it?.product?.name ?? it?.offerName ?? it?.offer?.name;
        if (n) names.add(String(n).toLowerCase());
      }
    }
  }
  return Array.from(names);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Validate Hubla signature/secret. Hubla sends an `X-Hubla-Token` header.
    // SECURITY: if the secret is not configured we MUST reject — otherwise an
    // attacker could forge purchase events and grant themselves course access.
    if (!HUBLA_SECRET) {
      console.error("HUBLA_WEBHOOK_SECRET is not configured — rejecting request");
      return new Response(JSON.stringify({ error: "webhook not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

    const body = await req.json().catch(() => ({}));
    const eventType: string =
      body?.type || body?.event?.type || body?.event_type || "unknown";

    // TEMP DEBUG: capture full payload to diagnose order bump structure
    console.log("HUBLA_RAW_PAYLOAD", JSON.stringify(body));
    console.log("HUBLA_EVENT_TYPE", eventType);

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
      if (m.hubla_product_id) {
        const target = String(m.hubla_product_id).toLowerCase();
        if (productIds.map((p) => p.toLowerCase()).includes(target)) return true;
      }
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
      // Make sure from_hubla flag is present so the auth-email-hook knows
      // to send the branded welcome template when this user gets a recovery
      // link (first-time password setup after purchase).
      if (found.user_metadata?.from_hubla !== true) {
        try {
          await admin.auth.admin.updateUserById(found.id, {
            user_metadata: { ...(found.user_metadata || {}), from_hubla: true, full_name: fullName },
          });
        } catch (e) {
          console.warn("failed to set from_hubla flag on existing user", e);
        }
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { full_name: fullName, from_hubla: true },
      });
      if (createErr) {
        // Race condition: another concurrent webhook (orderbump) may have just
        // created the same user. Re-query and continue with that user instead
        // of failing — otherwise we lose the access grants for this product.
        console.warn("createUser failed, re-querying existing user", createErr.message);
        const { data: retry } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const retryFound = retry?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (!retryFound) throw createErr;
        userId = retryFound.id;
      } else {
        userId = created.user!.id;
        createdNewUser = true;
      }
    }

    // Update profile with access flags + customer id.
    // CRITICAL: Hubla fires one webhook per invoice (main purchase + one per
    // order bump) and they run in parallel. A read-modify-write merge causes
    // a lost-update race: webhook B reads the profile BEFORE webhook A's
    // write lands, then writes back its own (false) values for the columns
    // that webhook A just enabled. To avoid that, we only issue UPDATEs for
    // the columns this specific invoice GRANTS as true. Setting `x = true`
    // is idempotent across concurrent writers.
    const updatePayload: Record<string, any> = {};
    if (grants.has_course_access) updatePayload.has_course_access = true;
    if (grants.has_ebook1_access) updatePayload.has_ebook1_access = true;
    if (grants.has_ebook2_access) updatePayload.has_ebook2_access = true;
    if (grants.has_ebook3_access) updatePayload.has_ebook3_access = true;
    if (customerId) updatePayload.hubla_customer_id = customerId;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updErr } = await admin
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", userId!);
      if (updErr) throw updErr;
    }

    // ---- VOICE CREDIT GRANTS (idempotent per event+product) ----
    const eventId = extractEventId(body);
    const purchaseId = extractPurchaseDedupeId(body);
    const creditResults: any[] = [];

    // Only grant voice credits for the PRIMARY product of this invoice.
    // Hubla sends one webhook per invoice and re-lists every sibling product
    // inside `event.products`, so iterating `productIds` would credit the
    // same product multiple times (once per sibling invoice). See
    // extractPrimaryProductId() for details.
    const primaryProductId = extractPrimaryProductId(body);
    if (primaryProductId) {
      const { data: grantResult, error: grantErr } = await admin.rpc("grant_voice_credits", {
        _user_id: userId!,
        _hubla_event_id: purchaseId,
        _hubla_product_id: primaryProductId,
        _raw_payload: body,
      });
      if (grantErr) {
        console.error("grant_voice_credits failed", { primaryProductId, eventId, grantErr });
        creditResults.push({ productId: primaryProductId, error: grantErr.message });
      } else {
        creditResults.push({ productId: primaryProductId, ...grantResult });
      }
    } else {
      console.warn("No primary product id found in webhook payload — skipping voice credit grant");
    }

    // Send the welcome / set-password email when:
    //  - we just created the user (first-ever purchase), OR
    //  - the user already existed but has never signed in
    //
    // CRITICAL: Hubla emits one webhook per invoice (main purchase + one per
    // order bump). Sending one recovery email per webhook would invalidate
    // all but the LAST token (Supabase rotates the recovery token on every
    // call), causing the student to receive N emails where only one works.
    // We use `profiles.welcome_email_sent_at` as a one-shot guard so the
    // welcome email is sent exactly once per user, no matter how many
    // sibling invoices Hubla fires.
    const lastSignIn = found?.last_sign_in_at ?? null;
    const eligibleForWelcome = createdNewUser || !lastSignIn;
    let shouldSendWelcome = false;
    if (eligibleForWelcome) {
      // Atomic claim: only one concurrent webhook will succeed in flipping
      // welcome_email_sent_at from NULL → now(). The others get 0 rows back
      // and skip sending. This avoids the race where 5 sibling webhooks all
      // read NULL at the same time and each sends a separate email
      // (with rotating recovery tokens that invalidate each other).
      const claimedAt = new Date().toISOString();
      const { data: claimRows, error: claimErr } = await admin
        .from("profiles")
        .update({ welcome_email_sent_at: claimedAt })
        .eq("user_id", userId!)
        .is("welcome_email_sent_at", null)
        .select("user_id");
      if (claimErr) {
        console.error("welcome email claim failed", claimErr);
      }
      shouldSendWelcome = !!claimRows && claimRows.length > 0;
    }
    if (shouldSendWelcome) {

      // Always redirect new students to the /auth page with their email pre-filled.
      // The frontend detects ?email=... and shows the "create password" form
      // with the email field locked (readOnly).
      const APP_URL = "https://falaebrasil.lovable.app";
      const redirectTo = `${APP_URL}/welcome?email=${encodeURIComponent(email)}`;
      // Use the public client's resetPasswordForEmail so Supabase Auth actually
      // SENDS the email (which triggers the auth-email-hook). admin.generateLink
      // only returns a link without sending — the hook never fires in that case.
      const publicClient = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { error: resetErr } = await publicClient.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );
      if (resetErr) {
        console.error("resetPasswordForEmail failed", resetErr);
        // Roll back the guard so a retry/next-event can send the email.
        await admin
          .from("profiles")
          .update({ welcome_email_sent_at: null })
          .eq("user_id", userId!);
      }
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
        recovery_link_sent: shouldSendWelcome,
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