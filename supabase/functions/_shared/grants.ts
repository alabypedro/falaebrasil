// Shared admin grant helpers: mirror the checkout (ASAAS) access logic.
// deno-lint-ignore-file no-explicit-any

export const TIERS = ["open", "pro", "vip", "kids", "teens", "bst"] as const;

/** Grants courses + BST products to one user, applying the same rules as a purchase. */
export async function applyGrantsToUser(
  admin: any,
  userId: string,
  courseIds: string[],
  bstProductIds: string[],
  planTier?: string | null,
) {
  const updates: Record<string, unknown> = {};
  if (courseIds.length > 0) updates.has_course_access = true;
  if (planTier && (TIERS as readonly string[]).includes(planTier)) updates.plan_tier = planTier;
  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("profiles").update(updates).eq("user_id", userId);
    if (error) throw error;
  }

  if (courseIds.length > 0) {
    const { error } = await admin.from("user_course_access").upsert(
      courseIds.map((course_id) => ({ user_id: userId, course_id, source: "admin" })),
      { onConflict: "user_id,course_id" },
    );
    if (error) throw error;
  }

  if (bstProductIds.length > 0) {
    const { error } = await admin.from("bst_product_access").upsert(
      bstProductIds.map((product_id) => ({ user_id: userId, product_id, source: "admin" })),
      { onConflict: "user_id,product_id" },
    );
    if (error) throw error;
    // BST-only buyer -> restricted "bst" segment, exactly like the checkout flow.
    if (courseIds.length === 0 && !planTier) await applyBstOnlyTier(admin, userId);
  }
}

/** Sets plan_tier='bst' only for accounts with no real plan (same guard as grant_access_from_asaas). */
export async function applyBstOnlyTier(admin: any, userId: string) {
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier, has_course_access")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return;
  const tier = String(profile.plan_tier ?? "").toLowerCase();
  if (profile.has_course_access || ["pro", "vip", "kids", "teens"].includes(tier)) return;

  const { count: courseCount } = await admin
    .from("user_course_access")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((courseCount ?? 0) > 0) return;

  const { data: subs } = await admin
    .from("asaas_subscriptions")
    .select("status")
    .eq("user_id", userId);
  const hasActiveSub = (subs ?? []).some((s: any) =>
    ["active", "overdue"].includes(String(s.status ?? "").toLowerCase())
  );
  if (hasActiveSub) return;

  await admin.from("profiles").update({ plan_tier: "bst" }).eq("user_id", userId);
}
