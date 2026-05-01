import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ExternalLink, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productKey: "essencial_pro_a1" | "ebook1" | "ebook2" | "ebook3";
  productName: string;
  checkoutUrl: string | null;
  description?: string;
  requiresCourseFirst?: boolean;
}

export function UpsellModal({
  open,
  onOpenChange,
  productKey,
  productName,
  checkoutUrl,
  description,
  requiresCourseFirst,
}: UpsellModalProps) {
  const [credits, setCredits] = useState<{ scripted: number; unscripted: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const { data: mapping } = await supabase
        .from("hubla_product_mapping")
        .select("hubla_product_id")
        .eq("product_key", productKey)
        .maybeSingle();
      if (!mapping?.hubla_product_id) {
        if (active) setCredits(null);
        return;
      }
      const { data: product } = await supabase
        .from("voice_credit_products")
        .select("scripted_seconds, unscripted_seconds")
        .eq("hubla_product_id", mapping.hubla_product_id)
        .maybeSingle();
      if (active) {
        setCredits(
          product
            ? { scripted: product.scripted_seconds, unscripted: product.unscripted_seconds }
            : null,
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [open, productKey]);

  const total = credits ? credits.scripted + credits.unscripted : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Conteúdo bloqueado</DialogTitle>
          <DialogDescription className="text-center">
            {description ?? `Para acessar "${productName}" você precisa adquirir esse material.`}
          </DialogDescription>
        </DialogHeader>

        {credits && total > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Mic className="h-4 w-4 text-primary" />
              Bônus IA Falaê incluso
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Modo com roteiro</span>
              <span className="font-medium tabular-nums text-foreground">+{credits.scripted}s</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Modo livre</span>
              <span className="font-medium tabular-nums text-foreground">+{credits.unscripted}s</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-primary/20">
              <span className="font-semibold">Total adicionado</span>
              <span className="font-bold tabular-nums text-primary">+{total}s</span>
            </div>
          </div>
        )}

        {requiresCourseFirst && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            ⚠️ Os Order Bumps só podem ser adquiridos junto com o curso <strong>Essencial Pro A1</strong>.
          </div>
        )}

        <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
          {checkoutUrl ? (
            <Button asChild className="w-full">
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                Comprar agora <ExternalLink className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button disabled className="w-full">
              Checkout em breve
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}