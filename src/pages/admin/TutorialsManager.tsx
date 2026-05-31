import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Trash2, ExternalLink } from "lucide-react";
import { TUTORIAL_TOPICS, parseYoutube } from "@/lib/tutorialTopics";

interface Row {
  id?: string;
  slug: string;
  video_url: string;
  is_published: boolean;
  saving?: boolean;
}

export default function TutorialsManager() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutorials")
      .select("id, slug, video_url, is_published");
    if (error) toast.error(error.message);
    const map: Record<string, Row> = {};
    TUTORIAL_TOPICS.forEach((t) => {
      const found = (data ?? []).find((r: any) => r.slug === t.slug);
      map[t.slug] = {
        id: found?.id,
        slug: t.slug,
        video_url: found?.video_url ?? "",
        is_published: found?.is_published ?? true,
      };
    });
    setRows(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (slug: string, patch: Partial<Row>) => {
    setRows((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));
  };

  const save = async (slug: string) => {
    const row = rows[slug];
    const topic = TUTORIAL_TOPICS.find((t) => t.slug === slug);
    if (!topic) return;
    const url = row.video_url.trim();
    if (url && !parseYoutube(url)) {
      toast.error("URL do YouTube inválida.");
      return;
    }
    update(slug, { saving: true });
    const payload = {
      slug,
      title: topic.title,
      description: topic.description,
      video_url: url || null,
      is_published: row.is_published,
      display_order: TUTORIAL_TOPICS.findIndex((t) => t.slug === slug),
    };
    const { error } = row.id
      ? await supabase.from("tutorials").update(payload).eq("id", row.id)
      : await supabase.from("tutorials").insert(payload);
    update(slug, { saving: false });
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo.");
    load();
  };

  const clear = async (slug: string) => {
    const row = rows[slug];
    if (!row.id) {
      update(slug, { video_url: "" });
      return;
    }
    const { error } = await supabase
      .from("tutorials")
      .update({ video_url: null })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vídeo removido.");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tutoriais</h2>
        <p className="text-sm text-muted-foreground">
          Para cada assunto, cole a URL de um vídeo do YouTube com status <strong>Unlisted</strong>.
        </p>
      </div>

      <div className="grid gap-4">
        {TUTORIAL_TOPICS.map((topic) => {
          const row = rows[topic.slug];
          if (!row) return null;
          const info = parseYoutube(row.video_url);
          const Icon = topic.icon;
          return (
            <Card key={topic.slug}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${topic.gradient}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{topic.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`url-${topic.slug}`}>URL do YouTube (Unlisted)</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`url-${topic.slug}`}
                      value={row.video_url}
                      onChange={(e) => update(topic.slug, { video_url: e.target.value })}
                      placeholder="https://youtu.be/... ou https://www.youtube.com/watch?v=..."
                    />
                    {info && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        asChild
                        title="Abrir no YouTube"
                      >
                        <a href={`https://www.youtube.com/watch?v=${info.id}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {row.video_url && !info && (
                    <p className="text-xs text-destructive">URL do YouTube inválida.</p>
                  )}
                </div>

                {info && (
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-black" onContextMenu={(e) => e.preventDefault()}>
                    <iframe
                      src={info.embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    {/* Camadas de proteção invisíveis para dificultar o compartilhamento */}
                    <div className="absolute top-0 left-0 w-full h-[60px] z-10 cursor-default" />
                    <div className="absolute bottom-0 right-0 w-[120px] h-[50px] z-10 cursor-default" />
                    <div className="absolute bottom-0 left-0 w-[80px] h-[50px] z-10 cursor-default" />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`pub-${topic.slug}`}
                      checked={row.is_published}
                      onCheckedChange={(v) => update(topic.slug, { is_published: v })}
                    />
                    <Label htmlFor={`pub-${topic.slug}`} className="text-sm">Publicado</Label>
                  </div>
                  <div className="flex gap-2">
                    {row.id && row.video_url && (
                      <Button variant="outline" size="sm" onClick={() => clear(topic.slug)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover vídeo
                      </Button>
                    )}
                    <Button size="sm" onClick={() => save(topic.slug)} disabled={row.saving}>
                      {row.saving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
