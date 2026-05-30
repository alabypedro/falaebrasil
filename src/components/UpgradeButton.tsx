import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Check, Crown, ExternalLink, MessageCircle, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function UpgradeButton() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [proUrl, setProUrl] = useState<string | null>(null);
  const [vipUrl, setVipUrl] = useState<string | null>(null);

  const tier: "open" | "pro" | "vip" = (profile?.plan_tier as any) ?? "open";

  useEffect(() => {
    if (!open) return;
    supabase
      .from("vip_config")
      .select("paid_chat_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const chatUrl = (data as any)?.paid_chat_url ?? null;
        setProUrl(chatUrl);
        setVipUrl(chatUrl);
      });
  }, [open]);

  // Já é VIP — nada a fazer
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

          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            {/* PRO */}
            {tier === "open" && (
              <div className="rounded-lg border-2 border-primary/30 bg-card p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Plano PRO</h3>
                    <p className="text-xs text-muted-foreground">Aprenda em comunidade</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-foreground flex-1">
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /> Tudo do plano OPEN</li>
                   <li className="flex gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /> Aulas ao vivo via Zoom em grupos</li>
                   <li className="flex gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /> Acesso aos níveis e horários que quiser toda semana</li>
                </ul>
                {proUrl ? (
                  <Button asChild className="w-full mt-4">
                    <a href={proUrl} target="_blank" rel="noopener noreferrer">
                      Conversar sobre PRO <ExternalLink className="ml-1.5 h-4 w-4" />
                    </a>
                   </Button>
                 ) : (
                   <Button disabled className="w-full mt-4">Saiba Mais</Button>
                 )}
              </div>
            )}

            {/* VIP */}
            <div className={`rounded-lg border-2 border-primary bg-gradient-to-br from-primary/5 to-transparent p-5 flex flex-col ${tier === "pro" ? "sm:col-span-2" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-1.5">
                    Plano VIP <GraduationCap className="h-4 w-4 text-primary" />
                  </h3>
                  <p className="text-xs text-muted-foreground">Aulas particulares</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-foreground flex-1">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /> Tudo do plano PRO</li>
                 <li className="flex gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /> Aulas em grupos fechados ou particulares (1:1)</li>
                 <li className="flex gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /> Horário fixo semanal</li>
              </ul>
              {vipUrl ? (
                <Button asChild className="w-full mt-4">
                  <a href={vipUrl} target="_blank" rel="noopener noreferrer">
                    Conversar sobre VIP <ExternalLink className="ml-1.5 h-4 w-4" />
                  </a>
                   </Button>
                 ) : (
                   <Button disabled className="w-full mt-4">Saiba Mais</Button>
                 )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}