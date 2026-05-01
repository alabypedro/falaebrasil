import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayCircle, Loader2 } from "lucide-react";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  display_order: number;
}

const gradients = [
  "bg-gradient-hero",
  "bg-gradient-accent",
  "bg-gradient-xp",
  "bg-gradient-to-br from-success to-success/70",
  "bg-gradient-to-br from-primary to-primary/70",
  "bg-gradient-to-br from-accent to-accent/70",
];

function parseYoutube(url: string | null): { id: string; embedUrl: string; thumb: string } | null {
  if (!url) return null;
  const m = url.trim().match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  const id = m?.[1] ?? (/^[\w-]{8,15}$/.test(url.trim()) ? url.trim() : null);
  if (!id) return null;
  return {
    id,
    embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

export default function Tutoriais() {
  const [items, setItems] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Tutorial | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("id, title, description, video_url, display_order")
        .eq("is_published", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      setItems((data as Tutorial[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const activeVideo = active ? parseYoutube(active.video_url) : null;

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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <PlayCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Em breve teremos vídeos por aqui. Volte mais tarde!
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => {
            const v = parseYoutube(t.video_url);
            const gradient = gradients[i % gradients.length];
            return (
              <Card
                key={t.id}
                className="animate-fade-up hover-lift card-shine cursor-pointer border-border/50 overflow-hidden group"
                style={{ "--delay": `${80 * (i + 1)}ms` } as React.CSSProperties}
                onClick={() => v && setActive(t)}
              >
                <div className={`relative aspect-video ${v ? "" : gradient} flex items-center justify-center`}>
                  {v ? (
                    <img
                      src={v.thumb}
                      alt={t.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                  <div className="relative flex flex-col items-center gap-2 text-white">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform">
                      <PlayCircle className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                      {v ? "Assistir" : "Vídeo em breve"}
                    </span>
                  </div>
                </div>
                <CardContent className="p-5 space-y-1.5">
                  <h3 className="text-sm font-display font-bold text-foreground leading-tight">
                    {t.title}
                  </h3>
                  {t.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
          </DialogHeader>
          {activeVideo && (
            <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
              <iframe
                src={activeVideo.embedUrl}
                className="w-full h-full"
                title={active?.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {active?.description && (
            <p className="text-sm text-muted-foreground">{active.description}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
