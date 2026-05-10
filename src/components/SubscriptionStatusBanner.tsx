import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function SubscriptionStatusBanner() {
  const { profile } = useAuth();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.subscription_status !== "past_due" && profile?.subscription_status !== "canceled") return;
    supabase
      .from("hubla_product_mapping")
      .select("checkout_url")
      .eq("product_key", "essencial_pro_a1")
      .maybeSingle()
      .then(({ data }) => setCheckoutUrl(data?.checkout_url ?? null));
  }, [profile?.subscription_status]);

  if (!profile) return null;
  const status = profile.subscription_status;
  if (status !== "past_due" && status !== "canceled") return null;

  if (status === "past_due") {
    const grace = profile.subscription_grace_until ? new Date(profile.subscription_grace_until) : null;
    const graceLabel = grace
      ? grace.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : null;
    return (
      <div className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200">
        <div className="px-4 md:px-6 py-2.5 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm flex-1 min-w-0">
            <strong>Sua mensalidade está em atraso.</strong>{" "}
            {graceLabel
              ? `Regularize até ${graceLabel} para não perder o acesso ao curso e à comunidade.`
              : "Regularize para não perder o acesso ao curso e à comunidade."}
          </p>
          {checkoutUrl && (
            <Button asChild size="sm" variant="default">
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                Regularizar agora
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // canceled
  return (
    <div className="w-full bg-destructive/15 border-b border-destructive/30 text-destructive">
      <div className="px-4 md:px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <XCircle className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm flex-1 min-w-0">
          <strong>Seu acesso foi bloqueado por inadimplência.</strong>{" "}
          Reative sua assinatura para voltar a acessar o curso, e-books e comunidade.
        </p>
        {checkoutUrl && (
          <Button asChild size="sm" variant="destructive">
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              Reativar assinatura
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}