import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, Headphones } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface LibraryItem {
  id: string;
  title: string;
  type: string;
  file_url: string | null;
  audio_url: string | null;
  created_at: string;
  access_key: string;
}

const emptyForm = { title: "", type: "ebook", file_url: "", audio_url: "", access_key: "free" };

const accessLabels: Record<string, string> = {
  free: "Grátis (todos)",
  ebook1: "E-book 1 (Anfitrião Soberano)",
  ebook2: "E-book 2 (Decodificador de Gringo)",
  ebook3: "E-book 3 (Vocabulário de Poder)",
};

export default function LibraryManager() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase.from("library_bst").select("*").order("created_at", { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => { load(); }, []);

  const filtered = filterType === "all" ? items : items.filter((i) => i.type === filterType);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (item: LibraryItem) => {
    setEditing(item);
    setForm({ title: item.title, type: item.type, file_url: item.file_url ?? "", audio_url: item.audio_url ?? "", access_key: item.access_key ?? "free" });
    setOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "file_url" | "audio_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = field === "file_url" ? setUploadingFile : setUploadingAudio;
    setUploading(true);
    const folder = field === "file_url" ? "library" : "library-audio";
    // Sanitize filename: remove accents, replace invalid chars (Supabase Storage rejects keys with ã, ç, spaces, etc.)
    const sanitized = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .replace(/[^a-zA-Z0-9._-]/g, "_") // replace any non-safe char with underscore
      .replace(/_+/g, "_");
    const path = `${folder}/${Date.now()}_${sanitized}`;
    const { error } = await supabase.storage.from("lesson-files").upload(path, file);
    if (error) { toast.error("Erro no upload: " + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
    setForm((prev) => ({ ...prev, [field]: data.publicUrl }));
    setUploading(false);
    toast.success("Arquivo enviado!");
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    setLoading(true);
    const payload = { title: form.title.trim(), type: form.type, file_url: form.file_url.trim() || null, audio_url: form.audio_url.trim() || null, access_key: form.access_key };

    if (editing) {
      const { error } = await supabase.from("library_bst").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Item atualizado!");
    } else {
      const { error } = await supabase.from("library_bst").insert(payload);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Item criado!");
    }
    setOpen(false); setLoading(false); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("library_bst").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Item excluído"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Biblioteca BST</h2>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ebook">E-books</SelectItem>
              <SelectItem value="audiobook">Audiobooks</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Item</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Arquivos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum item na biblioteca.</TableCell></TableRow>
            )}
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="gap-1">
                    {item.type === "ebook" ? <BookOpen className="h-3 w-3" /> : <Headphones className="h-3 w-3" />}
                    {item.type === "ebook" ? "E-book" : "Audiobook"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.access_key === "free" ? "outline" : "default"} className="text-[10px]">
                    {accessLabels[item.access_key] ?? item.access_key}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.file_url && <span className="mr-2">📄 PDF</span>}
                  {item.audio_url && <span>🎵 Áudio</span>}
                  {!item.file_url && !item.audio_url && "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir item?</AlertDialogTitle><AlertDialogDescription>O item será removido permanentemente da biblioteca.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome do e-book ou audiobook" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ebook">E-book</SelectItem>
                  <SelectItem value="audiobook">Audiobook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Acesso requerido</Label>
              <Select value={form.access_key} onValueChange={(v) => setForm({ ...form, access_key: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Grátis (todos os usuários)</SelectItem>
                  <SelectItem value="ebook1">E-book 1 — Anfitrião Soberano</SelectItem>
                  <SelectItem value="ebook2">E-book 2 — Decodificador de Gringo</SelectItem>
                  <SelectItem value="ebook3">E-book 3 — Vocabulário de Poder</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define qual flag de compra libera este item para o usuário.</p>
            </div>
            <div className="space-y-2">
              <Label>Arquivo PDF / E-book</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="application/pdf,application/epub+zip" onChange={(e) => handleUpload(e, "file_url")} disabled={uploadingFile} />
                {form.file_url && <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline whitespace-nowrap">Ver arquivo</a>}
              </div>
              {uploadingFile && <p className="text-xs text-muted-foreground">Enviando...</p>}
            </div>
            <div className="space-y-2">
              <Label>Arquivo de Áudio</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="audio/*" onChange={(e) => handleUpload(e, "audio_url")} disabled={uploadingAudio} />
                {form.audio_url && <a href={form.audio_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline whitespace-nowrap">Ouvir</a>}
              </div>
              {uploadingAudio && <p className="text-xs text-muted-foreground">Enviando...</p>}
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
