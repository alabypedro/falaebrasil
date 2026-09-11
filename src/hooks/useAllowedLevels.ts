import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { LEVEL_LIST } from "@/lib/levels";

/**
 * Níveis que o aluno pode ver/acessar.
 * `profiles.allowed_levels` vazio/nulo = todos os níveis (comportamento padrão).
 * Admins sempre veem todos.
 */
export function useAllowedLevels() {
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  const allowed = (profile as any)?.allowed_levels as string[] | null | undefined;

  const levels = useMemo(() => {
    if (isAdmin || !allowed || allowed.length === 0) return LEVEL_LIST;
    return LEVEL_LIST.filter((l) => allowed.includes(l));
  }, [isAdmin, allowed]);

  return {
    levels,
    restricted: !isAdmin && !!allowed && allowed.length > 0,
    isAllowed: (lv: string) => levels.includes(lv),
  };
}

/** Acesso ao módulo Estórias Curtas (padrão liberado). */
export function useBooksAccess() {
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();
  const flag = (profile as any)?.has_books_access;
  return isAdmin || flag !== false;
}
