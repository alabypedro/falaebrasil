# Architecture rules

- BST authorization is enforced server-side per product; only active OPEN membership and admins bypass individual product grants, because UI route guards are not security boundaries.
- BST PDFs live in the private `bst-files` bucket and are opened only through short-lived signed URLs after a server-side product-access check.
- Non-OPEN payment bundles cannot include an OPEN product, preventing an individual BST checkout from escalating into full catalog access.
- Meta Purchase tracking is a non-blocking server-side layer after confirmed ASAAS access grants; it must never affect access, email, refunds, or subscriptions.