# Architecture rules

- BST authorization is enforced server-side per product; only active OPEN membership and admins bypass individual product grants, because UI route guards are not security boundaries.
- BST PDFs live in the private `bst-files` bucket and are opened only through short-lived signed URLs after a server-side product-access check.
- Non-OPEN payment bundles cannot include an OPEN product, preventing an individual BST checkout from escalating into full catalog access.
- Meta Purchase tracking is a non-blocking server-side layer after confirmed ASAAS access grants; it must never affect access, email, refunds, or subscriptions.- Admin relationship data lives in dedicated admin-only tables and is read through an admin-checked RPC, so commercial notes never reach students and purchase/XP sources stay untouched.

- BST buyers get monthly scripted AI credits via grant_bst_monthly_credits (daily cron, logged per month index), because a unique log row per month prevents double credit.

- Relationship onboarding emails (D0, D+1, D+3) are sent hourly by relationship-auto-emails with one log row per step (relationship_email_log unique key), so a step is never sent twice; offer steps (D+30) stay human because sales offers cannot go through app emails.
