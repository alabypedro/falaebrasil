import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Crown, MessageCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const WHATSAPP_URL = "https://wa.me/5511981612800";

const PLANS = [
  {
    key: "pro",
    name: "Plano PRO",
    icon: MessageCircle,
    description:
      "Acesso ampliado às IAs e conteúdos avançados para acelerar seu inglês.",
  },
  {
    key: "vip",
    name: "Plano VIP",
    icon: Crown,
    description:
      "Experiência completa com atendimento prioritário e todos os recursos liberados.",
  },
];

export default function UpgradeButton() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const tier: "open" | "pro" | "vip" = (profile?.plan_tier as any) ?? "open";

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
              Você está no plano <strong className="uppercase">{tier}</strong>. Fale com nosso time no WhatsApp para um atendimento personalizado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            {PLANS.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.key}
                  className="rounded-lg border-2 border-primary/30 bg-card p-5 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-foreground">{p.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{p.description}</p>
                  <Button asChild className="w-full mt-4">
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                    >
                      Quero Upgrade <ExternalLink className="ml-1.5 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}