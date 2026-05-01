import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Smartphone, Apple, Monitor, PlayCircle } from "lucide-react";

type DeviceType = "ios" | "android" | "desktop";

function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export default function OnboardingTutorialModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const device = useMemo(detectDevice, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_tutorial")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.has_seen_tutorial === false) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ has_seen_tutorial: true })
      .eq("user_id", user.id);
    setSaving(false);
    setOpen(false);
  };

  const content = (() => {
    if (device === "ios") {
      return {
        icon: <Apple className="h-6 w-6 text-primary" />,
        title: "Como instalar o App no seu iPhone",
        description: "Assista ao vídeo abaixo para adicionar o Falaê Brasil! à tela inicial do seu iPhone ou iPad.",
      };
    }
    if (device === "android") {
      return {
        icon: <Smartphone className="h-6 w-6 text-primary" />,
        title: "Como instalar o App no seu Android",
        description: "Assista ao vídeo abaixo para instalar o Falaê Brasil! no seu Android.",
      };
    }
    return {
      icon: <Monitor className="h-6 w-6 text-primary" />,
      title: "Bem-vindo ao Portal!",
      description: "Conheça em poucos minutos como aproveitar todos os recursos do Falaê Brasil!",
    };
  })();

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent outside close */ }}>
      <DialogContent
        className="max-w-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {content.icon}
            <DialogTitle className="font-display">{content.title}</DialogTitle>
          </div>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>

        <div className="aspect-video w-full rounded-lg border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <PlayCircle className="h-10 w-10" />
          <p className="text-sm font-medium">Espaço reservado para vídeo</p>
          <p className="text-xs">Adicione aqui o embed do YouTube/Vimeo</p>
        </div>

        <Button
          onClick={handleConfirm}
          disabled={saving}
          size="lg"
          className="w-full bg-gradient-hero text-white shadow-soft-lg press-effect font-bold"
        >
          {saving ? "Salvando..." : "Entendi, vamos começar!"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}