import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "moderator" | "user" | "teacher";

/**
 * Papéis do usuário autenticado. A checagem é apenas para a UI —
 * a autorização real acontece nas policies/funções do banco.
 */
export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!active) return;
      setRoles((((data as any[]) ?? []).map((r) => r.role) as AppRole[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isTeacher: roles.includes("teacher"),
    loading,
  };
}
