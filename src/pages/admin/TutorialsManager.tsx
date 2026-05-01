import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, PlayCircle, Eye, EyeOff } from "lucide-react";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  display_order: number;
  is_published: boolean;
}

const emptyForm = { title: "", description: "", video_url: "", display_order: 0, is_published: true };

function parseYoutube(url: string): { id: string; embedUrl: string } | null {
  if (!url) return null;
  const trimmed = url.trim();
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt?.[1]) return { id: yt[1], embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  if (/^[\w-]{8,15}$/.test(trimmed)) return { id: trimmed, embedUrl: `https://www.youtube.com/embed/${trimmed}` };
  return null;
}

export default function TutorialsManager() {
  const [items, setItems] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutorials")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as Tutorial[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, display_order: items.length });
    setOpen(true);
  };

  const openEdit = (t: Tutorial) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      video_url: t.video_url ?? "",
      display_order: t.display_order,
      is_published: t.is_published,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Informe um título."); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      video_url: form.video_url.trim() || null,
      display_order: Number(form.display_order) || 0,
      is_published: form.is_published,
    };
    const { error } = editing
      ? await supabase.from("tutorials").update(payload).eq("id", editing.id)
      : await supabase.from("tutorials").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Tutorial atualizado." : "Tutorial criado.");
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tutorials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tutorial removido.");
    load();
  };

  const togglePublish = async (t: Tutorial) => {
    const { error } = await supabase
      .from("tutorials")
      .update({ is_published: !t.is_published })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const info = parseYoutube(form.video_url);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Tutoriais</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os vídeos de tutoriais exibidos para os alunos. Use links do YouTube com status <strong>Unlisted</strong>.
            </p>
          </div>
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Novo tutorial
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum tutorial cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Vídeo</TableHead>
                  <TableHead className="w-28">Publicado</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => {
                  const v = parseYoutube(t.video_url ?? "");
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="tabular-nums">{t.display_order}</TableCell>
                      <TableCell>
                        <div className="font-medium">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {v ? (
                          <a
                            href={`https://www.youtube.com/watch?v=${v.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <PlayCircle className="h-3.5 w-3.5" /> YouTube
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => togglePublish(t)}>
                          {t.is_published ? (
                            <><Eye className="h-3.5 w-3.5 mr-1" /> Sim</>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5 mr-1" /> Não</>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover tutorial?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(t.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tutorial" : "Novo tutorial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Como instalar o aplicativo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrição exibida no card."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video_url">URL do vídeo (YouTube — Unlisted)</Label>
              <Input
                id="video_url"
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://youtu.be/... ou https://www.youtube.com/watch?v=..."
              />
              {form.video_url && info && (
                <div className="aspect-video w-full overflow-hidden rounded-md border bg-black">
                  <iframe
                    src={info.embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              {form.video_url && !info && (
                <p className="text-xs text-destructive">URL do YouTube inválida.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="display_order">Ordem</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  id="is_published"
                  checked={form.is_published}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))}
                />
                <Label htmlFor="is_published">Publicado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
