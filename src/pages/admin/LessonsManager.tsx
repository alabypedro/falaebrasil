import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Video, FileText, ExternalLink, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  practice_text: string | null;
  display_order: number;
  modules?: { title: string; courses?: { title: string } | null } | null;
}

interface ModuleOption { id: string; title: string; course_title: string; }

interface LessonVideo {
  id?: string;
  title: string;
  video_url: string;
  display_order: number;
}

const emptyForm = { module_id: "", title: "", description: "", video_url: "", pdf_url: "", practice_text: "", display_order: 0 };

// Detect and normalize YouTube URLs / IDs
type VideoInfo = { provider: "youtube"; id: string; embedUrl: string; openUrl: string };

function parseVideo(url: string): VideoInfo | null {
  if (!url) return null;
  const trimmed = url.trim();
  // YouTube full URL (watch, embed, shorts, youtu.be)
  const yt = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  if (yt) {
    return {
      provider: "youtube",
      id: yt[1],
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
      openUrl: `https://youtu.be/${yt[1]}`,
    };
  }
  // Bare YouTube ID (11 chars, letters/digits/_-)
  if (/^[\w-]{11}$/.test(trimmed)) {
    return {
      provider: "youtube",
      id: trimmed,
      embedUrl: `https://www.youtube.com/embed/${trimmed}`,
      openUrl: `https://youtu.be/${trimmed}`,
    };
  }
  return null;
}

const VIDEO_SLOTS = 10;

function buildSlots(existing: LessonVideo[]): LessonVideo[] {
  const slots: LessonVideo[] = [];
  for (let i = 0; i < VIDEO_SLOTS; i++) {
    const found = existing.find((v) => v.display_order === i);
    slots.push(
      found ?? { title: `Videoaula ${i + 1}`, video_url: "", display_order: i },
    );
  }
  return slots;
}

export default function LessonsManager() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videos, setVideos] = useState<LessonVideo[]>([]);
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const [{ data: lsn }, { data: mods }, { data: vids }] = await Promise.all([
      supabase.from("lessons").select("*, modules(title, courses(title))").order("display_order"),
      supabase.from("modules").select("id, title, courses(title)").order("display_order"),
      supabase.from("lesson_videos").select("lesson_id"),
    ]);
    if (lsn) setLessons(lsn);
    if (mods) setModules(mods.map((m: any) => ({ id: m.id, title: m.title, course_title: m.courses?.title ?? "" })));
    if (vids) {
      const counts: Record<string, number> = {};
      vids.forEach((v: any) => { counts[v.lesson_id] = (counts[v.lesson_id] ?? 0) + 1; });
      setVideoCounts(counts);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filterModule === "all" ? lessons : lessons.filter((l) => l.module_id === filterModule);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, module_id: filterModule !== "all" ? filterModule : modules[0]?.id ?? "" });
    setVideos(buildSlots([]));
    setOpen(true);
  };

  const openEdit = async (l: Lesson) => {
    setEditing(l);
    setForm({ module_id: l.module_id, title: l.title, description: l.description ?? "", video_url: l.video_url ?? "", pdf_url: l.pdf_url ?? "", practice_text: l.practice_text ?? "", display_order: l.display_order });
    const { data } = await supabase
      .from("lesson_videos")
      .select("id, title, video_url, display_order")
      .eq("lesson_id", l.id)
      .order("display_order");
    setVideos(buildSlots((data ?? []) as LessonVideo[]));
    setOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = type === "pdf" ? setUploadingPdf : setUploadingVideo;
    setUploading(true);
    const folder = type === "pdf" ? "pdfs" : "videos";
    const path = `${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("lesson-files").upload(path, file);
    if (error) { toast.error("Erro no upload: " + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
    const field = type === "pdf" ? "pdf_url" : "video_url";
    setForm((prev) => ({ ...prev, [field]: data.publicUrl }));
    setUploading(false);
    toast.success(type === "pdf" ? "PDF enviado!" : "Vídeo enviado!");
  };

  const save = async () => {
    if (!form.title.trim() || !form.module_id) { toast.error("Preencha título e módulo"); return; }
    setLoading(true);
    const primaryVideo = videos[0]?.video_url?.trim() || form.video_url.trim() || null;
    const payload = { module_id: form.module_id, title: form.title.trim(), description: form.description.trim() || null, video_url: primaryVideo, pdf_url: form.pdf_url.trim() || null, practice_text: form.practice_text.trim() || null, display_order: form.display_order };

    let lessonId: string | null = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase.from("lessons").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else {
      const { data: inserted, error } = await supabase.from("lessons").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      lessonId = inserted!.id;
    }

    if (lessonId) {
      const keepIds = videos.filter((v) => v.id).map((v) => v.id!) as string[];
      let delQuery = supabase.from("lesson_videos").delete().eq("lesson_id", lessonId);
      if (keepIds.length > 0) delQuery = delQuery.not("id", "in", `(${keepIds.join(",")})`);
      await delQuery;

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const url = v.video_url.trim();
        if (!url) {
          // If this slot existed before but was cleared, remove it
          if (v.id) {
            await supabase.from("lesson_videos").delete().eq("id", v.id);
          }
          continue;
        }
        const row = { lesson_id: lessonId, title: v.title.trim() || `Videoaula ${i + 1}`, video_url: url, display_order: i };
        if (v.id) {
          await supabase.from("lesson_videos").update(row).eq("id", v.id);
        } else {
          await supabase.from("lesson_videos").insert(row);
        }
      }
    }

    toast.success(editing ? "Lição atualizada!" : "Lição criada!");
    setOpen(false); setLoading(false); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lição excluída"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Lições</h2>
        <div className="flex gap-2">
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.course_title} › {m.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Lição</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Mídia</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma lição cadastrada.</TableCell></TableRow>
            )}
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.display_order}</TableCell>
                <TableCell className="font-medium">{l.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{(l.modules as any)?.title ?? "—"}</TableCell>
                <TableCell className="flex gap-1">
                  {(videoCounts[l.id] ?? (l.video_url ? 1 : 0)) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-accent text-xs">
                      <Video className="h-4 w-4" />
                      {videoCounts[l.id] ?? 1}
                    </span>
                  )}
                  {l.pdf_url && <FileText className="h-4 w-4 text-muted-foreground" />}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir lição?</AlertDialogTitle><AlertDialogDescription>Quizzes vinculados também serão excluídos.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(l.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Lição" : "Nova Lição"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.course_title} › {m.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Videoaulas</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setVideos((prev) => [
                      ...prev,
                      { title: `Videoaula ${prev.length + 1}`, video_url: "", display_order: prev.length },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar vídeo
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Adicione uma ou mais videoaulas do YouTube. O aluno poderá alternar entre elas dentro da unidade.
              </p>

              {videos.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nenhuma videoaula adicionada. Clique em "Adicionar vídeo" para incluir a primeira.
                </div>
              )}

              {videos.map((v, idx) => {
                const info = parseVideo(v.video_url);
                const label = info ? "YouTube" : null;
                return (
                  <div key={v.id ?? `local-${idx}`} className="rounded-md border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                      <Input
                        value={v.title}
                        onChange={(e) =>
                          setVideos((prev) => prev.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it)))
                        }
                        placeholder={`Título da videoaula ${idx + 1}`}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={idx === 0}
                        onClick={() =>
                          setVideos((prev) => {
                            const next = [...prev];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return next;
                          })
                        }
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={idx === videos.length - 1}
                        onClick={() =>
                          setVideos((prev) => {
                            const next = [...prev];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            return next;
                          })
                        }
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setVideos((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={v.video_url}
                      onChange={(e) =>
                        setVideos((prev) => prev.map((it, i) => (i === idx ? { ...it, video_url: e.target.value } : it)))
                      }
                      placeholder="Link do YouTube (https://youtu.be/... ou https://youtube.com/watch?v=...)"
                    />
                    {v.video_url && info && (
                      <div className="flex items-center gap-2 text-[11px] text-success">
                        <Video className="h-3 w-3" />
                        <span>{label} detectado (ID: {info.id})</span>
                        <a
                          href={info.openUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {v.video_url && !info && (
                      <p className="text-[11px] text-warning">Link não reconhecido. Use uma URL válida do YouTube.</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>PDF da Aula</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="application/pdf" onChange={(e) => handleFileUpload(e, "pdf")} disabled={uploadingPdf} />
                {form.pdf_url && <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline whitespace-nowrap">Ver PDF</a>}
              </div>
              {uploadingPdf && <p className="text-xs text-muted-foreground">Enviando PDF...</p>}
            </div>
            <div className="space-y-2">
              <Label>Texto para Prática de Voz</Label>
              <Textarea
                value={form.practice_text}
                onChange={(e) => setForm({ ...form, practice_text: e.target.value })}
                rows={4}
                placeholder="Texto em inglês que o aluno lerá em voz alta no IA Falaê desta lição..."
              />
              <p className="text-[11px] text-muted-foreground">
                Este texto será carregado automaticamente quando o aluno entrar no IA Falaê a partir desta lição.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
