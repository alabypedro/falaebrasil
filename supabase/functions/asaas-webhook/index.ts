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
const APP_URL = "https://falaebrasil.lovable.app";

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
    if (customerId) {
      const { data: customerRow } = await admin
        .from("asaas_customers")
        .select("user_id")
        .eq("asaas_customer_id", customerId)
        .maybeSingle();
      userId = customerRow?.user_id ?? null;

      // Fallback: customer created directly on ASAAS (static payment link).
      // Fetch customer from ASAAS and match by email to an existing auth user.
      if (!userId) {
        try {
          const custResp = await fetchAsaas(`/customers/${customerId}`);
          if (custResp.ok) {
            const cust = await custResp.json();
            const email = (cust.email ?? "").toLowerCase().trim();
            const cpfCnpj = (cust.cpfCnpj ?? "").replace(/\D/g, "");
            const phone = (cust.mobilePhone ?? cust.phone ?? "").replace(/\D/g, "");

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

            if (userId) {
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
            } else {
              console.warn(`No user matched for ASAAS customer ${customerId} (email=${email})`);
            }
          } else {
            console.warn(`Failed to fetch ASAAS customer ${customerId}: ${custResp.status}`);
          }
        } catch (err) {
          console.error("Fallback customer lookup failed", err);
        }
      }
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
      if (eventType === "PAYMENT_CREATED" || eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
        result = await handlePaymentConfirmed(admin, payment, userId);
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
    .select("id, type, grants_course_access, grants_ebook1_access, grants_ebook2_access, grants_ebook3_access, grants_scripted_seconds, grants_unscripted_seconds")
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
