import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useStudentCategories } from "@/hooks/useStudentCategories";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aluno "BST only" (low ticket): categorizado como BST1/BST2/... sem a
 * categoria OPEN. Só pode acessar Bibliotecaê BST, Tutoriais e Instalar App,
 * e apenas os produtos BST que comprou.
 *
 * O fallback por `plan_tier === 'bst'` mantém compatibilidade com contas
 * criadas antes da categorização.
 */
export function useBstOnly() {
  const { profile, user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { isBstRestricted, hasOpenCategory, loading: catLoading } = useStudentCategories();
  const [slug, setSlug] = useState<string | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Categoria OPEN sempre libera tudo (mesmo que plan_tier legado seja "bst").
  const legacyBst =
    !hasOpenCategory && !!profile && profile.plan_tier === "bst" && !profile.has_course_access;
  const isBstOnly = !isAdmin && !hasOpenCategory && (isBstRestricted || legacyBst);

  useEffect(() => {
    if (!user || !isBstOnly) {
      setSlug(null);
      setSlugs([]);
      setLoading(adminLoading || catLoading || (!!user && !profile));
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
  }, [user, isBstOnly, adminLoading, catLoading, profile]);

  return { isBstOnly, slug, slugs, loading };
}
