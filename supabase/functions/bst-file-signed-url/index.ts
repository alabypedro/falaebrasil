import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storagePath(value: string): string | null {
  const marker = "/storage/v1/object/public/lesson-files/";
  if (value.includes(marker)) return value.split(marker)[1] ?? null;
  if (value.startsWith("bst/")) return value;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Server configuration error" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length).trim();
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as { productId?: unknown; pdfId?: unknown } | null;
    const productId = typeof body?.productId === "string" ? body.productId : "";
    const pdfId = typeof body?.pdfId === "string" ? body.pdfId : null;
    if (!UUID.test(productId) || (pdfId !== null && !UUID.test(pdfId))) {
      return json({ error: "Invalid request" }, 400);
    }

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: allowed } = await admin.rpc("has_bst_product_access", {
      _product_id: productId,
    }, { headers: { Authorization: authHeader } });
    if (!allowed) return json({ error: "Forbidden" }, 403);

    let storedValue: string | null = null;
    if (pdfId) {
      const { data } = await admin
        .from("bst_product_pdfs")
        .select("pdf_url")
        .eq("id", pdfId)
        .eq("bst_product_id", productId)
        .maybeSingle();
      storedValue = data?.pdf_url ?? null;
    } else {
      const { data } = await admin
        .from("bst_products")
        .select("pdf_url")
        .eq("id", productId)
        .maybeSingle();
      storedValue = data?.pdf_url ?? null;
    }

    const path = storedValue ? storagePath(storedValue) : null;
    if (!path || !path.startsWith("bst/")) return json({ error: "File not found" }, 404);

    const { data: signed, error: signedError } = await admin.storage
      .from("bst-files")
      .createSignedUrl(path, 600);
    if (signedError || !signed?.signedUrl) return json({ error: "Could not open file" }, 500);
    return json({ url: signed.signedUrl });
  } catch (error) {
    console.error("bst-file-signed-url error", error);
    return json({ error: "Internal server error" }, 500);
  }
});