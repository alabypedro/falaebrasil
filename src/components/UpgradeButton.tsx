import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Check, Crown, ExternalLink, MessageCircle, GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Product {
  product_key: string;
  name: string;
  price_cents: number;
  type: "subscription" | "one_time";
  description: string | null;
}

export default function UpgradeButton() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [needsCpf, setNeedsCpf] = useState(false);

  const tier: "open" | "pro" | "vip" = (profile?.plan_tier as any) ?? "open";

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("payment_products")
      .select("*")
      .eq("active", true)
      .order("display_order")
      .then(({ data }) => {
        setProducts((data ?? []) as Product[]);
        setLoading(false);
      });
  }, [open]);

  if (tier === "vip") return null;

  const createCheckout = async (productKey: string) => {
    const cpfClean = cpf.replace(/\D/g, "");
    if (needsCpf && cpfClean.length < 11) {
      toast.error("Informe um CPF/CNPJ válido");
      return;
    }
    setCreating(productKey);
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) {
      toast.error("Você precisa estar logado");
      setCreating(null);
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
          product_key: productKey,
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
        setCreating(null);
        return;
      }
      toast.success("Checkout criado!");
      window.open(body.invoice_url, "_blank", "noopener,noreferrer");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(null);
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 text-primary-foreground gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Upgrade de plano
      </Button>
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
        title="Fazer upgrade"
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Faça upgrade do seu plano</DialogTitle>
            <DialogDescription className="text-center">
              Você está no plano <strong className="uppercase">{tier}</strong>. Compare e escolha o melhor pra você.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              Nenhum plano de upgrade disponível no momento.
            </div>
          )}

          {needsCpf && (
            <div className="space-y-1.5">
              <Label className="text-xs">CPF/CNPJ obrigatório em produção</Label>
              <Input
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            {products.map((p) => (
              <div
                key={p.product_key}
                className="rounded-lg border-2 border-primary/30 bg-card p-5 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {p.product_key.includes("vip") ? (
                      <Crown className="h-5 w-5 text-primary" />
                    ) : p.product_key.includes("pro") ? (
                      <MessageCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <GraduationCap className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      R$ {(p.price_cents / 100).toFixed(2)} {p.type === "subscription" && "/ mês"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex-1">{p.description || "—"}</p>
                <Button
                  className="w-full mt-4"
                  onClick={() => createCheckout(p.product_key)}
                  disabled={creating === p.product_key}
                >
                  {creating === p.product_key ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <ExternalLink className="ml-1.5 h-4 w-4" />
                  )}
                  {creating === p.product_key ? "Gerando..." : "Comprar agora"}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
