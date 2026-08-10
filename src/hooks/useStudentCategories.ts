import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StudentCategory {
  code: string;
  label: string;
  kind: "open" | "bst";
  bst_product_id: string | null;
}

/**
 * Categorias do aluno (OPEN / BST1 / BST2 ...).
 * OPEN = acesso a tudo. Categorias BST (sem OPEN) = acesso restrito
 * à Biblioteca BST, Tutoriais e Instalar App.
 */
export function useStudentCategories() {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("student_categories")
      .select("code, student_category_defs(code, label, kind, bst_product_id)")
      .eq("user_id", user.id);
    const rows: any[] = (data as any[]) ?? [];
    setCategories(
      rows
        .map((r) => r.student_category_defs)
        .filter(Boolean)
        .map((d: any) => ({
          code: d.code,
          label: d.label,
          kind: d.kind,
          bst_product_id: d.bst_product_id,
        }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Mudanças de categoria feitas pelo admin refletem ao voltar para a aba.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const hasOpenCategory = categories.some((c) => c.kind === "open");
  const bstCategories = categories.filter((c) => c.kind === "bst");

  // Assinatura em dia? Alunos sem assinatura registrada (liberação manual)
  // continuam considerados em dia.
  const status = (profile?.subscription_status ?? "").toLowerCase();
  const graceOk =
    !!profile?.subscription_grace_until &&
    new Date(profile.subscription_grace_until) > new Date();
  const subscriptionCurrent =
    ["", "none", "active", "trialing", "authorized"].includes(status) || graceOk;

  /** OPEN efetivo: categoria OPEN + assinatura em dia (inadimplente perde acesso). */
  const hasOpen = hasOpenCategory && subscriptionCurrent;

  return {
    categories,
    hasOpen,
    hasOpenCategory,
    subscriptionCurrent,
    bstCategories,
    /** Tem categoria BST e não tem OPEN -> restrito. */
    isBstRestricted: !hasOpenCategory && bstCategories.length > 0,
    loading,
    refresh: load,
  };
}
