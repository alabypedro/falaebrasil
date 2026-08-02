import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Smartphone, Apple, Monitor, PlayCircle, Library } from "lucide-react";
import { useOSDetection } from "@/hooks/useOSDetection";
import { parseYoutube } from "@/lib/tutorialTopics";

type Variant = "install" | "bst";

/**
 * Pop-up de PRIMEIRO ACESSO.
 * - variant="install": vídeo de instalação do app (alunos OPEN).
 * - variant="bst": vídeo tutorial da Biblioteca BST (alunos BST / low ticket).
 * Cada variante tem sua própria flag no perfil, então aparece só uma vez.
 */
export default function OnboardingTutorialModal({ variant = "install" }: { variant?: Variant }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const device = useOSDetection();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const flagColumn = variant === "bst" ? "has_seen_bst_tutorial" : "has_seen_tutorial";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(flagColumn)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && (data as any)[flagColumn] === false) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user, flagColumn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (variant === "bst") {
        const { data } = await supabase
          .from("tutorials")
          .select("video_url")
          .eq("slug", "biblioteca-bst")
          .maybeSingle();
        if (!cancelled) setVideoUrl(data?.video_url ?? null);
        return;
      }
      const { data } = await supabase
        .from("install_tutorial_videos")
        .select("video_url")
        .eq("platform", device)
        .maybeSingle();
      if (!cancelled) setVideoUrl(data?.video_url ?? null);
    })();
    return () => { cancelled = true; };
  }, [device, variant]);

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ [flagColumn]: true } as any)
      .eq("user_id", user.id);
    setSaving(false);
    setOpen(false);
  };

  const content = (() => {
    if (variant === "bst") {
      return {
        icon: <Library className="h-6 w-6 text-primary" />,
        title: "Como usar a Biblioteca BST",
        description:
          "Assista ao vídeo abaixo para aprender a usar seus guias, cartilhas e manuais da Biblioteca BST.",
      };
    }
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
      title: "Como instalar o App no seu computador",
      description: "Assista ao vídeo abaixo para instalar o Falaê Brasil! no seu PC.",
    };
  })();

  const yt = parseYoutube(videoUrl);

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

        {yt ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black" onContextMenu={(e) => e.preventDefault()}>
            <iframe
              src={yt.embedUrl}
              className="w-full h-full"
              title={content.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {/* Camadas de proteção invisíveis */}
            <div className="absolute top-0 left-0 w-full h-[60px] z-10 cursor-default" />
            <div className="absolute bottom-0 right-0 w-[120px] h-[50px] z-10 cursor-default" />
            <div className="absolute bottom-0 left-0 w-[80px] h-[50px] z-10 cursor-default" />
          </div>
        ) : (
          <div className="aspect-video w-full rounded-lg border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <PlayCircle className="h-10 w-10" />
            <p className="text-sm font-medium">Vídeo em breve</p>
            <p className="text-xs">O administrador ainda não cadastrou este tutorial.</p>
          </div>
        )}

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