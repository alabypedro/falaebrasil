import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Crown, ExternalLink, MessageCircle, GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  product_key: string;
  name: string;
  price_cents: number;
  type: "subscription" | "one_time";
  description: string | null;
  checkout_url: string | null;
}

export default function UpgradeButton() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

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
                {p.checkout_url ? (
                  <Button asChild className="w-full mt-4">
                    <a href={p.checkout_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                      Comprar agora <ExternalLink className="ml-1.5 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button className="w-full mt-4" disabled onClick={() => toast.error("Checkout ainda não configurado.")}>
                    Checkout indisponível
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
