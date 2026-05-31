import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Apple, Smartphone, Monitor, Save, PlayCircle } from "lucide-react";
import { parseYoutube } from "@/lib/tutorialTopics";
import type { DevicePlatform } from "@/hooks/useOSDetection";

interface Row {
  platform: DevicePlatform;
  title: string;
  video_url: string | null;
}

const META: Record<DevicePlatform, { label: string; help: string; icon: any }> = {
  ios: {
    label: "iOS (iPhone / iPad)",
    help: "Vídeo exibido para alunos que acessam pelo Safari em iPhone ou iPad.",
    icon: Apple,
  },
  android: {
    label: "Android",
    help: "Vídeo exibido para alunos que acessam por celular ou tablet Android.",
    icon: Smartphone,
  },
  desktop: {
    label: "Desktop / PC",
    help: "Vídeo exibido para alunos que acessam pelo computador (Windows, Mac ou Linux).",
    icon: Monitor,
  },
};

const ORDER: DevicePlatform[] = ["ios", "android", "desktop"];

export default function InstallTutorialVideosManager() {
  const [rows, setRows] = useState<Record<DevicePlatform, Row>>({
    ios: { platform: "ios", title: "", video_url: "" },
    android: { platform: "android", title: "", video_url: "" },
    desktop: { platform: "desktop", title: "", video_url: "" },
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<DevicePlatform | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("install_tutorial_videos")
      .select("platform, title, video_url");
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      const next = { ...rows };
      (data ?? []).forEach((r: any) => {
        if (r.platform in next) {
          next[r.platform as DevicePlatform] = {
            platform: r.platform,
            title: r.title ?? "",
            video_url: r.video_url ?? "",
          };
        }
      });
      setRows(next);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (p: DevicePlatform, key: "title" | "video_url", value: string) => {
    setRows((prev) => ({ ...prev, [p]: { ...prev[p], [key]: value } }));
  };

  const save = async (p: DevicePlatform) => {
    setSavingKey(p);
    const r = rows[p];
    const { error } = await supabase
      .from("install_tutorial_videos")
      .update({
        title: r.title || "Como instalar o aplicativo",
        video_url: r.video_url?.trim() || null,
      })
      .eq("platform", p);
    setSavingKey(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo", description: `Vídeo de ${META[p].label} atualizado.` });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vídeos tutoriais de instalação</CardTitle>
          <CardDescription>
            Configure 3 versões do vídeo "Como instalar o aplicativo". O sistema detecta automaticamente
            o dispositivo do aluno e mostra a versão correta no pop-up de boas-vindas e na aba "Tutoriais".
            Cole a URL completa do YouTube (ex: <code>https://youtu.be/abc123</code>).
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {ORDER.map((p) => {
            const meta = META[p];
            const Icon = meta.icon;
            const yt = parseYoutube(rows[p].video_url);
            return (
              <Card key={p}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-xs">{meta.help}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${p}`}>Título</Label>
                    <Input
                      id={`title-${p}`}
                      value={rows[p].title}
                      onChange={(e) => updateField(p, "title", e.target.value)}
                      placeholder="Como instalar o aplicativo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`url-${p}`}>URL do vídeo (YouTube)</Label>
                    <Input
                      id={`url-${p}`}
                      value={rows[p].video_url ?? ""}
                      onChange={(e) => updateField(p, "video_url", e.target.value)}
                      placeholder="https://youtu.be/..."
                    />
                  </div>

                  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted/40 border border-border" onContextMenu={(e) => e.preventDefault()}>
                    {yt ? (
                      <>
                        <iframe
                          src={yt.embedUrl}
                          className="w-full h-full"
                          title={meta.label}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        {/* Camadas de proteção invisíveis para dificultar o compartilhamento */}
                        <div className="absolute top-0 left-0 w-full h-[60px] z-10 cursor-default" />
                        <div className="absolute bottom-0 right-0 w-[120px] h-[50px] z-10 cursor-default" />
                        <div className="absolute bottom-0 left-0 w-[80px] h-[50px] z-10 cursor-default" />
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
                        <PlayCircle className="h-8 w-8" />
                        <p className="text-xs">Pré-visualização do vídeo</p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => save(p)}
                    disabled={savingKey === p}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {savingKey === p ? "Salvando..." : "Salvar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}