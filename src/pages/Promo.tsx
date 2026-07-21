import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink, Tag, ArrowLeft } from "lucide-react";

type PromoData = {
  code: string;
  checkout_url: string;
  price_cents: number;
  product: {
    name: string;
    description: string | null;
    price_cents: number;
    type: "subscription" | "one_time";
  };
};

export default function Promo() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [promo, setPromo] = useState<PromoData | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    supabase
      .from("payment_product_coupons")
      .select("code, checkout_url, price_cents, payment_products!inner(name, description, price_cents, type, active)")
      .eq("code", code.toUpperCase())
      .eq("active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).payment_products?.active) {
          const p = (data as any).payment_products;
          setPromo({
            code: (data as any).code,
            checkout_url: (data as any).checkout_url,
            price_cents: (data as any).price_cents,
            product: {
              name: p.name,
              description: p.description,
              price_cents: p.price_cents,
              type: p.type,
            },
          });
        }
        setLoading(false);
      });
  }, [code]);

  const priceLabel = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !promo ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Cupom inválido</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Este código promocional não existe ou não está mais ativo.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/40">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <div className="text-xs uppercase tracking-wider text-primary font-mono">
                Cupom {promo.code}
              </div>
              <CardTitle>{promo.product.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {promo.product.description && (
                <p className="text-sm text-muted-foreground text-center">{promo.product.description}</p>
              )}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-1">
                {promo.price_cents < promo.product.price_cents && (
                  <div className="text-sm text-muted-foreground line-through">
                    {priceLabel(promo.product.price_cents)}
                  </div>
                )}
                <div className="text-3xl font-bold text-foreground">
                  {priceLabel(promo.price_cents)}
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  {promo.product.type === "subscription" ? "assinatura" : "pagamento único"}
                </div>
              </div>
              <Button asChild size="lg" className="w-full">
                <a href={promo.checkout_url} target="_blank" rel="noopener noreferrer">
                  Ir para o checkout <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Você será redirecionado para o checkout seguro do ASAAS.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}