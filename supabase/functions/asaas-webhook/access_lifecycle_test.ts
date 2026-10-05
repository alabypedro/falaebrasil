import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test("ASAAS access lifecycle: pending, approved, canceled and refunded", async () => {
  if (!url || !serviceKey) throw new Error("Missing backend test environment");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = crypto.randomUUID();
  const email = `asaas-sandbox-${suffix}@example.invalid`;
  const pendingPaymentId = `sandbox_pending_${suffix}`;
  const refundedPaymentId = `sandbox_refunded_${suffix}`;
  let userId: string | null = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${crypto.randomUUID()}Aa1!`,
      user_metadata: { automated_sandbox_test: true },
    });
    if (createError || !created.user) throw createError ?? new Error("Test user was not created");
    userId = created.user.id;

    const insertPayment = async (paymentId: string, status: string) => {
      const { error } = await admin.from("asaas_payments").insert({
        asaas_payment_id: paymentId,
        user_id: userId,
        product_key: "bst1",
        status,
        billing_type: "PIX",
        value_cents: 100,
        raw_payload: { sandbox_test: true },
      });
      if (error) throw error;
    };

    const activeEntitlements = async (paymentId: string) => {
      const { count, error } = await admin
        .from("asaas_access_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("asaas_payment_id", paymentId)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    };

    // Pending payments must never grant access.
    await insertPayment(pendingPaymentId, "PENDING");
    const { data: pendingGrant, error: pendingError } = await admin.rpc("grant_access_from_asaas", {
      _user_id: userId,
      _asaas_payment_id: pendingPaymentId,
      _product_key: "bst1",
      _raw: { sandbox_test: true, status: "PENDING" },
    });
    if (pendingError) throw pendingError;
    assertEquals(pendingGrant?.granted, false);
    assertEquals(pendingGrant?.reason, "payment_not_confirmed");
    assertEquals(await activeEntitlements(pendingPaymentId), 0);

    // The same payment grants only after confirmation.
    const { error: confirmError } = await admin
      .from("asaas_payments")
      .update({ status: "CONFIRMED" })
      .eq("asaas_payment_id", pendingPaymentId);
    if (confirmError) throw confirmError;
    const { data: approvedGrant, error: approvedError } = await admin.rpc("grant_access_from_asaas", {
      _user_id: userId,
      _asaas_payment_id: pendingPaymentId,
      _product_key: "bst1",
      _raw: { sandbox_test: true, status: "CONFIRMED" },
    });
    if (approvedError) throw approvedError;
    assertEquals(approvedGrant?.granted, true);
    assert((await activeEntitlements(pendingPaymentId)) > 0);

    // Cancellation revokes only entitlements originating from this payment.
    const { data: canceled, error: cancelError } = await admin.rpc("revoke_access_from_asaas", {
      _user_id: userId,
      _asaas_payment_id: pendingPaymentId,
      _asaas_subscription_id: null,
      _reason: "canceled_sandbox_test",
    });
    if (cancelError) throw cancelError;
    assert(canceled?.revoked > 0);
    assertEquals(await activeEntitlements(pendingPaymentId), 0);

    // A separate paid purchase grants, then a refund removes its own access.
    await insertPayment(refundedPaymentId, "RECEIVED");
    const { data: receivedGrant, error: receivedError } = await admin.rpc("grant_access_from_asaas", {
      _user_id: userId,
      _asaas_payment_id: refundedPaymentId,
      _product_key: "bst1",
      _raw: { sandbox_test: true, status: "RECEIVED" },
    });
    if (receivedError) throw receivedError;
    assertEquals(receivedGrant?.granted, true);
    assert((await activeEntitlements(refundedPaymentId)) > 0);

    const { error: refundStatusError } = await admin
      .from("asaas_payments")
      .update({ status: "REFUNDED" })
      .eq("asaas_payment_id", refundedPaymentId);
    if (refundStatusError) throw refundStatusError;
    const { data: refunded, error: refundError } = await admin.rpc("revoke_access_from_asaas", {
      _user_id: userId,
      _asaas_payment_id: refundedPaymentId,
      _asaas_subscription_id: null,
      _reason: "refunded_sandbox_test",
    });
    if (refundError) throw refundError;
    assert(refunded?.revoked > 0);
    assertEquals(await activeEntitlements(refundedPaymentId), 0);
  } finally {
    if (userId) {
      await admin.from("asaas_access_entitlements").delete().eq("user_id", userId);
      await admin.from("bst_product_access").delete().eq("user_id", userId);
      await admin.from("user_course_access").delete().eq("user_id", userId);
      await admin.from("student_categories").delete().eq("user_id", userId);
      await admin.from("asaas_payments").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }
});