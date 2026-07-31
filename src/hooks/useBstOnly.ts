import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aluno "BST only": comprou apenas um produto Low-Ticket da Biblioteca BST.
 * Não tem acesso ao restante da plataforma.
 */
export function useBstOnly() {
  const { profile, user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [slug, setSlug] = useState<string | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isBstOnly =
    !isAdmin &&
    !!profile &&
    profile.plan_tier === "bst" &&
    !profile.has_course_access;

  useEffect(() => {
    if (!user || !isBstOnly) {
      setSlug(null);
      setSlugs([]);
      setLoading(adminLoading || (!!user && !profile));
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("bst_product_access")
        .select("product_id, bst_products(slug)")
        .eq("user_id", user.id)
        .order("granted_at", { ascending: false });
      const rows: any[] = (data as any[]) ?? [];
      const list = rows.map((r) => r?.bst_products?.slug).filter(Boolean) as string[];
      setSlugs(list);
      setSlug(list[0] ?? null);
      setLoading(false);
    })();
  }, [user, isBstOnly, adminLoading, profile]);

  return { isBstOnly, slug, slugs, loading };
}
