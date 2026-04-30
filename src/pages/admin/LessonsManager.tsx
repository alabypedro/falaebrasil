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
import { Plus, Pencil, Trash2, Video, FileText, ExternalLink } from "lucide-react";
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

const emptyForm = { module_id: "", title: "", description: "", video_url: "", pdf_url: "", practice_text: "", display_order: 0 };

// Detect and normalize Vimeo URLs / IDs
function parseVimeo(url: string): { id: string; embedUrl: string } | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Bare numeric ID
  if (/^\d{6,}$/.test(trimmed)) {
    return { id: trimmed, embedUrl: `https://player.vimeo.com/video/${trimmed}` };
  }
  const match = trimmed.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/i);
  if (match) {
    return { id: match[1], embedUrl: `https://player.vimeo.com/video/${match[1]}` };
  }
  return null;
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

  const load = async () => {
    const [{ data: lsn }, { data: mods }] = await Promise.all([
      supabase.from("lessons").select("*, modules(title, courses(title))").order("display_order"),
      supabase.from("modules").select("id, title, courses(title)").order("display_order"),
    ]);
    if (lsn) setLessons(lsn);
    if (mods) setModules(mods.map((m: any) => ({ id: m.id, title: m.title, course_title: m.courses?.title ?? "" })));
  };

  useEffect(() => { load(); }, []);

  const filtered = filterModule === "all" ? lessons : lessons.filter((l) => l.module_id === filterModule);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, module_id: filterModule !== "all" ? filterModule : modules[0]?.id ?? "" }); setOpen(true); };

  const openEdit = (l: Lesson) => {
    setEditing(l);
    setForm({ module_id: l.module_id, title: l.title, description: l.description ?? "", video_url: l.video_url ?? "", pdf_url: l.pdf_url ?? "", practice_text: l.practice_text ?? "", display_order: l.display_order });
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
    const payload = { module_id: form.module_id, title: form.title.trim(), description: form.description.trim() || null, video_url: form.video_url.trim() || null, pdf_url: form.pdf_url.trim() || null, practice_text: form.practice_text.trim() || null, display_order: form.display_order };

    if (editing) {
      const { error } = await supabase.from("lessons").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Lição atualizada!");
    } else {
      const { error } = await supabase.from("lessons").insert(payload);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Lição criada!");
    }
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
                  {l.video_url && <Video className="h-4 w-4 text-accent" />}
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
              <Label>Videoaula</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="Cole o link do Vimeo, YouTube ou ID do Vimeo (ex: 123456789)"
              />
              {form.video_url && (() => {
                const vimeo = parseVimeo(form.video_url);
                if (vimeo) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-success">
                        <Video className="h-3.5 w-3.5" />
                        <span>Vídeo do Vimeo detectado (ID: {vimeo.id})</span>
                        <a
                          href={`https://vimeo.com/${vimeo.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted">
                        <iframe
                          src={vimeo.embedUrl}
                          className="h-full w-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title="Preview Vimeo"
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <p className="text-[11px] text-muted-foreground">
                    URL salva. Para Vimeo, cole o link completo (https://vimeo.com/...) ou apenas o ID numérico.
                  </p>
                );
              })()}
              <details className="text-[11px] text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Ou enviar arquivo direto (não recomendado para vídeos longos)
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileUpload(e, "video")}
                    disabled={uploadingVideo}
                  />
                  {uploadingVideo && <span className="text-xs">Enviando...</span>}
                </div>
                <p className="mt-1">
                  Recomendamos hospedar vídeos no Vimeo e colar a URL acima — melhor performance e player profissional.
                </p>
              </details>
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
