import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayCircle } from "lucide-react";
import { TUTORIAL_TOPICS, parseYoutube } from "@/lib/tutorialTopics";
import { useOSDetection } from "@/hooks/useOSDetection";

export default function Tutoriais() {
  const [videoBySlug, setVideoBySlug] = useState<Record<string, string | null>>({});
  const [active, setActive] = useState<{ title: string; embedUrl: string } | null>(null);
  const platform = useOSDetection();

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: installRow }] = await Promise.all([
        supabase
        .from("tutorials")
        .select("slug, video_url")
        .eq("is_published", true),
        supabase
        .from("install_tutorial_videos")
        .select("video_url")
        .eq("platform", platform)
        .maybeSingle(),
      ]);
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((r: any) => {
        if (r.slug) map[r.slug] = r.video_url;
      });
      // Override "instalar-app" with the OS-specific video managed in the dedicated admin tab
      map["instalar-app"] = installRow?.video_url ?? null;
      setVideoBySlug(map);
    };
    load();
  }, [platform]);

  return (
    <div className="space-y-8 max-w-6xl page-transition">
      <div className="animate-fade-up">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground tracking-tight">
          Tutoriais
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Aprenda a aproveitar ao máximo o Falaê Brasil! com nossos vídeos guiados.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TUTORIAL_TOPICS.map((t, i) => {
          const v = parseYoutube(videoBySlug[t.slug]);
          const clickable = !!v;
          return (
            <Card
              key={t.slug}
              onClick={() => v && setActive({ title: t.title, embedUrl: v.embedUrl })}
              className={`animate-fade-up hover-lift card-shine border-border/50 overflow-hidden group ${clickable ? "cursor-pointer" : ""}`}
              style={{ "--delay": `${80 * (i + 1)}ms` } as React.CSSProperties}
            >
              <div className={`relative aspect-video ${t.gradient} flex items-center justify-center`}>
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                <div className="relative flex flex-col items-center gap-2 text-white">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <PlayCircle className="h-7 w-7" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                    {clickable ? "Assistir" : "Vídeo em breve"}
                  </span>
                </div>
              </div>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <t.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-display font-bold text-foreground leading-tight">
                      {t.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
              <iframe
                src={active.embedUrl}
                className="w-full h-full"
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
