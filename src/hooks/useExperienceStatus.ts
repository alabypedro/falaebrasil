import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ExperienceStatus = {
  active: boolean;
  segment?: "adults" | "kids_teens";
  started_at?: string;
  expires_at?: string;
  days_left?: number;
};

const EMPTY: ExperienceStatus = { active: false };

/**
 * Estado da Experiência PRO de 30 dias (compra avulsa de R$5).
 * Vem do backend (`get_experience_status`), que só devolve a experiência
 * enquanto ela estiver dentro do prazo de 30 dias.
 */
export function useExperienceStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ExperienceStatus>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStatus(EMPTY);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    supabase
      .rpc("get_experience_status")
      .then(({ data, error }) => {
        if (!alive) return;
        setStatus(error || !data ? EMPTY : ((data as unknown) as ExperienceStatus));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  return { ...status, loading };
}
