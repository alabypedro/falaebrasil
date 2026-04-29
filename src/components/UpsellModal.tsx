import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ExternalLink } from "lucide-react";

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
  productName,
  checkoutUrl,
  description,
  requiresCourseFirst,
}: UpsellModalProps) {
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