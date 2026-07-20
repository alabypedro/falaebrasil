import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SubscriptionStatusBanner() {
  const { profile } = useAuth();
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [needsCpf, setNeedsCpf] = useState(false);
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (profile?.subscription_status !== "past_due" && profile?.subscription_status !== "canceled") return;
    supabase
      .from("payment_products")
      .select("product_key")
      .eq("active", true)
      .eq("product_key", "plano_open")
      .maybeSingle()
      .then(() => {
        // no-op: we only need to know the key exists; the key is always "plano_open".
      });
  }, [profile?.subscription_status]);

  if (!profile) return null;
  const status = profile.subscription_status;
  if (status !== "past_due" && status !== "canceled") return null;

  const createCheckout = async () => {
    const cpfClean = cpf.replace(/\D/g, "");
    if (needsCpf && cpfClean.length < 11) {
      toast.error("Informe um CPF/CNPJ válido");
      return;
    }
    setCreating(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) {
      toast.error("Você precisa estar logado");
      setCreating(false);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_key: "plano_open",
          cpf_cnpj: cpfClean || undefined,
          phone: profile?.phone || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.needsCpf) {
          setNeedsCpf(true);
          toast.error("Informe o CPF/CNPJ para continuar");
        } else {
          toast.error(body.error || "Erro ao criar checkout");
        }
        setCreating(false);
        return;
      }
      setInvoiceUrl(body.invoice_url);
      toast.success("Checkout criado!");
      window.open(body.invoice_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const actionButton = () => {
    if (invoiceUrl) {
      return (
        <Button asChild size="sm" variant={status === "past_due" ? "default" : "destructive"}>
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
            Abrir checkout
          </a>
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant={status === "past_due" ? "default" : "destructive"}
        onClick={createCheckout}
        disabled={creating}
      >
        {creating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
        {status === "past_due" ? "Regularizar agora" : "Reativar assinatura"}
      </Button>
    );
  };

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
          {actionButton()}
        </div>
        {needsCpf && (
          <div className="px-4 md:px-6 pb-3">
            <Label className="text-xs">CPF/CNPJ obrigatório em produção</Label>
            <Input
              className="max-w-xs mt-1"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>
        )}
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
        {actionButton()}
      </div>
      {needsCpf && (
        <div className="px-4 md:px-6 pb-3">
          <Label className="text-xs">CPF/CNPJ obrigatório em produção</Label>
          <Input
            className="max-w-xs mt-1"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
