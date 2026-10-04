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
const ANON = getEnv("SUPABASE_ANON_KEY");
const APP_URL = "https://app.falaebrasil.com.br";
const DEFAULT_META_PIXEL_ID = "2142327090010383";
const DEFAULT_META_GRAPH_VERSION = "v24.0";

interface BuyerContact {
  email?: string;
  phone?: string;
}

interface AsaasEvent {
  event: string;
  id?: string;
  dateCreated?: string;
  payment?: any;
  subscription?: any;
}

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
    // Validate ASAAS webhook token (header: asaas-access-token)
    const token = req.headers.get("asaas-access-token") ?? "";
    if (token !== getEnv("ASAAS_WEBHOOK_TOKEN")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event: AsaasEvent = await req.json();
    const eventId = event.id ?? `${event.event}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Idempotency: skip if already processed
    const { data: existing } = await admin
      .from("asaas_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record the event (even if we fail later, to avoid retrying loops)
    await admin.from("asaas_webhook_events").insert({
      event_id: eventId,
      event_type: event.event,
      raw_payload: event,
      status: "processing",
      payment_id: event.payment?.id ?? null,
      subscription_id: event.subscription?.id ?? event.payment?.subscription ?? null,
    });

    const payment = event.payment;
    const subscription = event.subscription;

    // Resolve user from ASAAS customer id
    const customerId = payment?.customer ?? subscription?.customer;
    let userId: string | null = null;
    let buyerContact: BuyerContact = {};
    if (customerId) {
      // The buyer's email is the source of truth: ASAAS reuses the same customer
      // record for a repeat buyer (same CPF/phone) even when they check out with a
      // different email, so trusting the stored customer→user mapping would grant
      // access to the wrong account and skip the welcome email.
      let customerEmail = "";
      {
        try {
          const custResp = await fetchAsaas(`/customers/${customerId}`);
          if (custResp.ok) {
            const cust = await custResp.json();
            const email = (cust.email ?? "").toLowerCase().trim();
            customerEmail = email;
            const cpfCnpj = (cust.cpfCnpj ?? "").replace(/\D/g, "");
            const phone = (cust.mobilePhone ?? cust.phone ?? "").replace(/\D/g, "");
            buyerContact = { email, phone };

            if (email) {
              const { data: profileRow } = await admin
                .from("profiles")
                .select("user_id")
                .ilike("email", email)
                .maybeSingle();
              if (profileRow?.user_id) {
                userId = profileRow.user_id;
              }
            }

            // Fallbacks below only apply when ASAAS gave us no email at all.
            // With an email present we must NEVER match by CPF/phone, otherwise a
            // second purchase from the same person on a different email would be
            // attached to the first account.
            if (!userId && !email) {
              const { data: customerRow } = await admin
                .from("asaas_customers")
                .select("user_id")
                .eq("asaas_customer_id", customerId)
                .maybeSingle();
              userId = customerRow?.user_id ?? null;
            }

            if (!userId && !email && cpfCnpj) {
              const { data: byCpf } = await admin
                .from("asaas_customers")
                .select("user_id")
                .eq("cpf_cnpj", cpfCnpj)
                .limit(1)
                .maybeSingle();
              if (byCpf?.user_id) userId = byCpf.user_id;
            }

            if (!userId && !email && phone && phone.length >= 10) {
              const { data: byPhone } = await admin
                .from("profiles")
                .select("user_id")
                .ilike("phone", `%${phone.slice(-9)}%`)
                .limit(1)
                .maybeSingle();
              if (byPhone?.user_id) userId = byPhone.user_id;
            }

            // Still no match → create a new auth user so we can grant access
            // and send the welcome email. Marks `from_hubla: true` so the
            // auth-email-hook uses the branded welcome_purchase template.
            if (!userId && email) {
              try {
                const { data: created, error: createErr } =
                  await admin.auth.admin.createUser({
                    email,
                    email_confirm: true,
                    password:
                      crypto.randomUUID() + crypto.randomUUID(),
                    user_metadata: {
                      from_hubla: true,
                      full_name: cust.name ?? null,
                      phone: phone || null,
                    },
                  });
                if (!createErr && created?.user?.id) {
                  userId = created.user.id;
                  console.log("Created new user from ASAAS purchase", { email, userId });
                } else if (createErr) {
                  console.error("Failed to create user from ASAAS", createErr);
                }
              } catch (createEx) {
                console.error("createUser threw", createEx);
              }
            }

            if (userId) {
              // asaas_customer_id is unique: only (re)bind it when it is free or
              // already owned by this user, so a shared ASAAS customer record does
              // not steal the mapping from another student.
              const { data: ownerRow } = await admin
                .from("asaas_customers")
                .select("user_id")
                .eq("asaas_customer_id", customerId)
                .maybeSingle();
              if (!ownerRow || ownerRow.user_id === userId) {
                await admin.from("asaas_customers").upsert(
                  {
                    user_id: userId,
                    asaas_customer_id: customerId,
                    cpf_cnpj: cpfCnpj || null,
                    phone: phone || null,
                  },
                  { onConflict: "user_id" },
                );
                await admin
                  .from("profiles")
                  .update({ asaas_customer_id: customerId })
                  .eq("user_id", userId);
              }
            } else {
              console.warn(`No user matched for ASAAS customer ${customerId} (email=${email})`);
            }
          } else {
            console.warn(`Failed to fetch ASAAS customer ${customerId}: ${custResp.status}`);
            const { data: customerRow } = await admin
              .from("asaas_customers")
              .select("user_id")
              .eq("asaas_customer_id", customerId)
              .maybeSingle();
            userId = customerRow?.user_id ?? null;
          }
        } catch (err) {
          console.error("Fallback customer lookup failed", err);
        }
      }
      void customerEmail;
    }

    // Normalize payment/subscription payload into our tables
    if (payment) {
      await upsertPayment(admin, payment, userId);
    }
    if (subscription) {
      await upsertSubscription(admin, subscription, userId);
    }

    // Route actions by event type
    const eventType = event.event;
    let result: any = { processed: true };
    try {
      if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
        result = await handlePaymentConfirmed(admin, payment, userId);
        if (result.handled === true && result.product_key) {
          try {
            result.meta_purchase = await sendMetaPurchase(
              admin,
              payment,
              result.product_key,
              buyerContact,
            );
          } catch (metaErr) {
            console.error("Meta Purchase failed (non-fatal)", {
              paymentId: payment?.id,
              productKey: result.product_key,
              error: (metaErr as Error).message,
            });
            result.meta_purchase = { sent: false, reason: "meta_request_failed" };
          }
        }
      } else if (eventType === "PAYMENT_OVERDUE") {
        result = await handlePaymentOverdue(admin, payment, userId);
      } else if (eventType === "PAYMENT_REFUNDED") {
        result = await handlePaymentRefunded(admin, payment, userId);
      } else if (eventType === "PAYMENT_DELETED") {
        result = await handlePaymentRevoked(admin, payment, userId);
      } else if (
        eventType === "SUBSCRIPTION_DELETED" ||
        eventType === "SUBSCRIPTION_INACTIVATED" ||
        eventType === "SUBSCRIPTION_UPDATED"
      ) {
        result = await handleSubscriptionEvent(admin, subscription, userId, eventType);
      } else {
        result = { handled: false, reason: "unhandled_event_type" };
      }

      await admin
        .from("asaas_webhook_events")
        .update({ status: "processed", user_id: userId, result })
        .eq("event_id", eventId);

      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr) {
      console.error("asaas-webhook handler error", innerErr);
      await admin
        .from("asaas_webhook_events")
        .update({
          status: "failed",
          user_id: userId,
          error: (innerErr as Error).message,
        })
        .eq("event_id", eventId);
      return new Response(JSON.stringify({ error: (innerErr as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("asaas-webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertPayment(admin: any, payment: any, userId: string | null) {
  const productKey = payment.description ?? payment.subscription?.description ?? null;
  const { error } = await admin.from("asaas_payments").upsert(
    {
      asaas_payment_id: payment.id,
      user_id: userId,
      asaas_subscription_id: payment.subscription?.id ?? null,
      product_key: productKey,
      status: payment.status,
      billing_type: payment.billingType,
      value_cents: Math.round((payment.value ?? 0) * 100),
      net_value_cents: payment.netValue ? Math.round(payment.netValue * 100) : null,
      due_date: payment.dueDate,
      paid_at: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : null,
      invoice_url: payment.invoiceUrl,
      bank_slip_url: payment.bankSlipUrl,
      pix_qr_code: payment.pixQrCodeId,
      pix_copy_paste: payment.pixTransaction?.qrCode ?? payment.pixCopyPaste ?? null,
      raw_payload: payment,
    },
    { onConflict: "asaas_payment_id" },
  );
  if (error) throw error;
}

async function upsertSubscription(admin: any, subscription: any, userId: string | null) {
  const { error } = await admin.from("asaas_subscriptions").upsert(
    {
      asaas_subscription_id: subscription.id,
      user_id: userId,
      product_key: subscription.description ?? null,
      status: subscription.status,
      cycle: subscription.cycle,
      value_cents: Math.round((subscription.value ?? 0) * 100),
      next_due_date: subscription.nextDueDate,
      canceled_at: subscription.canceledDate ? new Date(subscription.canceledDate).toISOString() : null,
    },
    { onConflict: "asaas_subscription_id" },
  );
  if (error) throw error;
}

async function resolveProductKey(admin: any, payment: any): Promise<string | null> {
  const rawKey = (payment.description ?? payment.subscription?.description ?? "").trim();

  // First, try exact product_key match
  if (rawKey) {
    const { data: exact } = await admin
      .from("payment_products")
      .select("product_key")
      .eq("product_key", rawKey)
      .eq("active", true)
      .maybeSingle();
    if (exact) return exact.product_key;

    // Fallback: match by name (case-insensitive)
    const { data: byName } = await admin
      .from("payment_products")
      .select("product_key")
      .ilike("name", rawKey)
      .eq("active", true)
      .maybeSingle();
    if (byName) return byName.product_key;
  }

  // Static ASAAS payment links often arrive without description. In that case,
  // match the webhook paymentLink id to the Admin checkout_url saved for the product.
  const paymentLinkId = (payment.paymentLink ?? payment.paymentLinkId ?? "").trim();
  if (paymentLinkId) {
    const { data: byCheckoutUrl } = await admin
      .from("payment_products")
      .select("product_key")
      .ilike("checkout_url", `%${paymentLinkId}%`)
      .eq("active", true)
      .maybeSingle();
    if (byCheckoutUrl) return byCheckoutUrl.product_key;

    // Coupon / promotional link → resolves to the parent product_key
    const { data: coupon } = await admin
      .from("payment_product_coupons")
      .select("product_id, payment_products!inner(product_key, active)")
      .ilike("checkout_url", `%${paymentLinkId}%`)
      .eq("active", true)
      .maybeSingle();
    if (coupon && (coupon as any).payment_products?.active) {
      return (coupon as any).payment_products.product_key;
    }
  }

  return null;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeBrazilianPhone(value?: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function metaSourceUrl(productKey: string): string {
  const urls: Record<string, string> = {
    bst1: "https://falaebrasil.com.br/bst1",
    bst2: "https://falaebrasil.com.br/bst2",
    bst4: "https://falaebrasil.com.br/bst4",
    bst5: "https://falaebrasil.com.br/bst5",
    combo_bst1_bst4: "https://falaebrasil.com.br/bst1",
    combo_bst2_bst5: "https://falaebrasil.com.br/bst2",
    combo_bst5_bst1: "https://falaebrasil.com.br/bst5",
    combo_bst5_bst4: "https://falaebrasil.com.br/bst5",
    combo_bst5_bst1_bst4: "https://falaebrasil.com.br/bst5",
    pro_adultos: "https://falaebrasil.com.br/lp/adultos",
    pro_kids_teens: "https://falaebrasil.com.br/lp/kids-teens",
  };
  return urls[productKey.toLowerCase()] ?? "https://falaebrasil.com.br";
}

async function resolveMetaProduct(admin: any, productKey: string) {
  const { data: product, error: productError } = await admin
    .from("payment_products")
    .select("id, product_key, name, type")
    .eq("product_key", productKey)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) return null;

  const { data: bundleRows, error: bundleError } = await admin
    .from("payment_product_bundles")
    .select("included_product_id, payment_products!payment_product_bundles_included_product_id_fkey(product_key)")
    .eq("product_id", product.id);
  if (bundleError) throw bundleError;

  const bundledKeys = (bundleRows ?? [])
    .map((row: any) => row.payment_products?.product_key)
    .filter((key: unknown): key is string => typeof key === "string")
    .map((key: string) => key.toUpperCase());

  return {
    name: product.name || productKey,
    type: product.type,
    contentIds: bundledKeys.length > 0 ? bundledKeys : [productKey.toUpperCase()],
  };
}

async function isSubscriptionRenewal(admin: any, payment: any): Promise<boolean> {
  const subscriptionId = typeof payment?.subscription === "string"
    ? payment.subscription
    : payment?.subscription?.id;
  if (!subscriptionId || !payment?.id) return false;

  const { data, error } = await admin
    .from("asaas_payments")
    .select("asaas_payment_id")
    .eq("asaas_subscription_id", subscriptionId)
    .neq("asaas_payment_id", payment.id)
    .not("access_granted_at", "is", null)
    .in("status", ["RECEIVED", "CONFIRMED"])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function sendMetaPurchase(
  admin: any,
  payment: any,
  productKey: string,
  buyer: BuyerContact,
) {
  const token = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  if (!token) {
    console.warn("Meta Purchase skipped", { paymentId: payment?.id, productKey, reason: "missing_meta_token" });
    return { sent: false, reason: "missing_meta_token" };
  }
  if (!payment?.id) return { sent: false, reason: "missing_payment_id" };

  const metaProduct = await resolveMetaProduct(admin, productKey);
  if (!metaProduct) return { sent: false, reason: "product_not_found" };
  if (metaProduct.type === "subscription" && await isSubscriptionRenewal(admin, payment)) {
    return { sent: false, reason: "subscription_renewal" };
  }

  const normalizedEmail = (buyer.email ?? "").trim().toLowerCase();
  const normalizedPhone = normalizeBrazilianPhone(buyer.phone);
  const userData: Record<string, string[]> = {};
  if (normalizedEmail) userData.em = [await sha256(normalizedEmail)];
  if (normalizedPhone) userData.ph = [await sha256(normalizedPhone)];

  const value = Number(payment.value ?? 0);
  const pixelId = Deno.env.get("META_PIXEL_ID") || DEFAULT_META_PIXEL_ID;
  const graphVersion = Deno.env.get("META_GRAPH_VERSION") || DEFAULT_META_GRAPH_VERSION;
  const payload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `asaas_${payment.id}`,
      action_source: "website",
      event_source_url: metaSourceUrl(productKey),
      user_data: userData,
      custom_data: {
        currency: "BRL",
        value,
        content_type: "product",
        content_ids: metaProduct.contentIds,
        content_name: metaProduct.name,
      },
    }],
  };

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Meta Purchase rejected", {
      paymentId: payment.id,
      productKey,
      contentIds: metaProduct.contentIds,
      value,
      status: response.status,
      response: responseBody,
    });
    return { sent: false, reason: "meta_api_error", status: response.status };
  }

  console.log("Meta Purchase sent", {
    paymentId: payment.id,
    productKey,
    contentIds: metaProduct.contentIds,
    value,
    eventsReceived: responseBody.events_received ?? null,
  });
  return { sent: true };
}

async function handlePaymentConfirmed(admin: any, payment: any, userId: string | null) {
  if (!userId || !payment?.id) return { handled: false, reason: "missing_user_or_payment" };

  const productKey = await resolveProductKey(admin, payment);
  if (!productKey) return { handled: false, reason: "unknown_product_key", key: payment.description };

  // Grant access via idempotent RPC
  const { data, error } = await admin.rpc("grant_access_from_asaas", {
    _user_id: userId,
    _asaas_payment_id: payment.id,
    _product_key: productKey,
    _raw: payment,
  });
  if (error) throw error;

  // Send welcome/onboarding email for first-time buyers (no prior sign-in).
  try {
    await sendWelcomePurchaseEmail(admin, userId);
  } catch (mailErr) {
    console.error("welcome email send failed (non-fatal)", mailErr);
  }

  // Update subscription period end if it is a subscription payment
  if (payment.subscription?.id) {
    const subResp = await fetchAsaas(`/subscriptions/${payment.subscription.id}`);
    if (subResp.ok) {
      const sub = await subResp.json();
      await admin.from("asaas_subscriptions").upsert(
        {
          asaas_subscription_id: sub.id,
          user_id: userId,
          product_key: productKey,
          status: sub.status,
          cycle: sub.cycle,
          value_cents: Math.round((sub.value ?? 0) * 100),
          next_due_date: sub.nextDueDate,
          canceled_at: sub.canceledDate ? new Date(sub.canceledDate).toISOString() : null,
        },
        { onConflict: "asaas_subscription_id" },
      );

      await admin
        .from("profiles")
        .update({
          asaas_subscription_id: sub.id,
          subscription_status: "active",
          subscription_current_period_end: sub.nextDueDate,
          subscription_grace_until: null,
        })
        .eq("user_id", userId);
    }
  } else {
    await admin
      .from("profiles")
      .update({
        asaas_customer_id: payment.customer,
        subscription_status: "active",
      })
      .eq("user_id", userId);
  }

  return { handled: true, product_key: productKey, grant: data };
}

async function handlePaymentOverdue(admin: any, payment: any, userId: string | null) {
  if (!userId) return { handled: false, reason: "missing_user" };

  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + 7);

  await admin
    .from("profiles")
    .update({
      subscription_status: "past_due",
      subscription_grace_until: graceUntil.toISOString(),
    })
    .eq("user_id", userId);

  return { handled: true, status: "past_due", grace_until: graceUntil.toISOString() };
}

async function handlePaymentRevoked(admin: any, payment: any, userId: string | null) {
  if (!userId) return { handled: false, reason: "missing_user" };

  // For one-time payments, only revoke if the product was a subscription item
  // (ebooks are one-time and should not revoke access)
  const productKey = await resolveProductKey(admin, payment);
  if (productKey) {
    const { data: product } = await admin
      .from("payment_products")
      .select("type")
      .eq("product_key", productKey)
      .maybeSingle();
    if (product?.type === "subscription") {
      await admin
        .from("profiles")
        .update({
          subscription_status: "canceled",
          has_course_access: false,
          has_ebook1_access: false,
          has_ebook2_access: false,
          has_ebook3_access: false,
        })
        .eq("user_id", userId);
    }
  }

  return { handled: true, status: "canceled" };
}

async function handlePaymentRefunded(admin: any, payment: any, userId: string | null) {
  if (!userId) return { handled: false, reason: "missing_user" };

  const productKey = await resolveProductKey(admin, payment);
  if (!productKey) return { handled: false, reason: "unknown_product_key" };

  const { data: product } = await admin
    .from("payment_products")
    .select("id, type, grants_bst_product_id, grants_course_access, grants_ebook1_access, grants_ebook2_access, grants_ebook3_access, grants_scripted_seconds, grants_unscripted_seconds")
    .eq("product_key", productKey)
    .maybeSingle();
  if (!product) return { handled: false, reason: "product_not_found" };

  const update: Record<string, any> = {};
  if (product.grants_course_access) update.has_course_access = false;
  if (product.grants_ebook1_access) update.has_ebook1_access = false;
  if (product.grants_ebook2_access) update.has_ebook2_access = false;
  if (product.grants_ebook3_access) update.has_ebook3_access = false;
  if (product.type === "subscription") {
    update.subscription_status = "canceled";
    update.subscription_grace_until = null;
  }

  if (Object.keys(update).length > 0) {
    await admin.from("profiles").update(update).eq("user_id", userId);
  }

  // Remove course access rows tied to this product
  const { data: prodCourses } = await admin
    .from("payment_product_courses")
    .select("course_id")
    .eq("product_id", product.id);
  if (prodCourses && prodCourses.length > 0) {
    await admin
      .from("user_course_access")
      .delete()
      .eq("user_id", userId)
      .in("course_id", prodCourses.map((c: any) => c.course_id));
  }

  // Remove BST product access granted by this payment product
  if (product.grants_bst_product_id) {
    await admin
      .from("bst_product_access")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", product.grants_bst_product_id);
  }

  return { handled: true, status: "refunded", revoked: update, product_key: productKey };
}

async function handleSubscriptionEvent(admin: any, subscription: any, userId: string | null, eventType: string) {
  if (!userId || !subscription?.id) return { handled: false, reason: "missing_user_or_subscription" };

  const isInactivation =
    eventType === "SUBSCRIPTION_DELETED" ||
    eventType === "SUBSCRIPTION_INACTIVATED" ||
    subscription.status === "CANCELED" ||
    subscription.status === "EXPIRED" ||
    subscription.status === "INACTIVE";

  if (isInactivation) {
    await admin
      .from("profiles")
      .update({
        subscription_status: "canceled",
        has_course_access: false,
        has_ebook1_access: false,
        has_ebook2_access: false,
        has_ebook3_access: false,
        subscription_grace_until: null,
      })
      .eq("user_id", userId);

    // Remove all course_access rows granted through subscription products for this user
    const { data: subProducts } = await admin
      .from("payment_products")
      .select("id")
      .eq("type", "subscription");
    if (subProducts && subProducts.length > 0) {
      const { data: prodCourses } = await admin
        .from("payment_product_courses")
        .select("course_id")
        .in("product_id", subProducts.map((p: any) => p.id));
      if (prodCourses && prodCourses.length > 0) {
        await admin
          .from("user_course_access")
          .delete()
          .eq("user_id", userId)
          .in("course_id", prodCourses.map((c: any) => c.course_id));
      }
    }
  } else {
    await admin
      .from("profiles")
      .update({
        asaas_subscription_id: subscription.id,
        subscription_status: subscription.status === "ACTIVE" ? "active" : "past_due",
        subscription_current_period_end: subscription.nextDueDate,
      })
      .eq("user_id", userId);
  }

  return { handled: true, status: subscription.status, event: eventType, inactivated: isInactivation };
}

// Sends the branded "welcome_purchase" email to first-time buyers.
// Reuses the auth-email-hook flow: the hook detects `from_hubla=true`
// + never signed in and swaps recovery → welcome_purchase automatically.
async function sendWelcomePurchaseEmail(admin: any, userId: string) {
  const { data: userRes, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !userRes?.user) return;
  const user = userRes.user;
  const email = user.email;
  if (!email) return;

  // Only onboard first-time buyers. Returning users already have access.
  if (user.last_sign_in_at) return;

  const meta = user.user_metadata || {};
  // Skip if we already sent a welcome email recently (prevents dup sends
  // when ASAAS emits CREATED + RECEIVED + CONFIRMED in quick succession
  // and hits the auth email rate limit).
  if (meta.welcome_email_sent_at) {
    console.log("Welcome purchase email already sent, skipping", { email, userId });
    return;
  }

  // Ensure the flag is set so auth-email-hook renders welcome_purchase.
  if (meta.from_hubla !== true) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, from_hubla: true },
    });
  }

  const redirectTo = `${APP_URL}/welcome?email=${encodeURIComponent(email)}`;
  const publicClient = createClient(SUPABASE_URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: resetErr } = await publicClient.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (resetErr) {
    console.error("resetPasswordForEmail (asaas welcome) failed", resetErr);
    return;
  }
  console.log("Welcome purchase email sent", { email, userId });
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...meta,
      from_hubla: true,
      welcome_email_sent_at: new Date().toISOString(),
    },
  });
}
