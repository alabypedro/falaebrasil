import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ExternalLink, Mic, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface UpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productKey: string;
  productName?: string;
  checkoutUrl?: string | null;
  description?: string;
  requiresCourseFirst?: boolean;
}

interface PaymentProduct {
  id: string;
  product_key: string;
  name: string;
  description: string | null;
  type: "subscription" | "one_time";
  price_cents: number;
  grants_scripted_seconds: number;
  grants_unscripted_seconds: number;
}

export function UpsellModal({
  open,
  onOpenChange,
  productKey,
  productName,
  description,
  requiresCourseFirst,
}: UpsellModalProps) {
  const { profile } = useAuth();
  const [product, setProduct] = useState<PaymentProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cpf, setCpf] = useState("");
  const [needsCpf, setNeedsCpf] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setInvoiceUrl(null);
      setNeedsCpf(false);
      setCpf(profile?.phone ? "" : "");
      return;
    }
    setLoading(true);
    supabase
      .from("payment_products")
      .select("*")
      .eq("product_key", productKey)
      .eq("active", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
        } else if (data) {
          setProduct(data as PaymentProduct);
        }
        setLoading(false);
      });
  }, [open, productKey]);

  const total = product ? product.grants_scripted_seconds + product.grants_unscripted_seconds : 0;

  const createCheckout = async () => {
    if (!product) return;
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
          product_key: product.product_key,
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

  const displayName = productName || product?.name || productKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Conteúdo bloqueado</DialogTitle>
          <DialogDescription className="text-center">
            {description ?? `Para acessar "${displayName}" você precisa adquirir esse material.`}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !product && (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground text-center">
            Checkout indisponível no momento.
          </div>
        )}

        {product && (
          <>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <div className="text-2xl font-bold text-foreground">
                R$ {(product.price_cents / 100).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground uppercase">
                {product.type === "subscription" ? "assinatura" : "pagamento único"}
              </div>
            </div>

            {total > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mic className="h-4 w-4 text-primary" />
                  Bônus IA Falaê incluso
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Modo com roteiro</span>
                  <span className="font-medium tabular-nums text-foreground">+{product.grants_scripted_seconds}s</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Modo livre</span>
                  <span className="font-medium tabular-nums text-foreground">+{product.grants_unscripted_seconds}s</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-1 border-t border-primary/20">
                  <span className="font-semibold">Total adicionado</span>
                  <span className="font-bold tabular-nums text-primary">+{total}s</span>
                </div>
              </div>
            )}

            {needsCpf && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  CPF/CNPJ obrigatório em produção
                </Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                />
              </div>
            )}

            {requiresCourseFirst && (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                ⚠️ Os Order Bumps só podem ser adquiridos junto com o curso <strong>Falaê Brasil!</strong>.
              </div>
            )}

            <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
              {invoiceUrl ? (
                <Button asChild className="w-full">
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Abrir checkout <ExternalLink className="ml-1.5 h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button onClick={createCheckout} disabled={creating} className="w-full">
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <ExternalLink className="ml-1.5 h-4 w-4" />
                  )}
                  {creating ? "Gerando checkout..." : "Comprar agora"}
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
