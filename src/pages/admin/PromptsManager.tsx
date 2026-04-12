import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Loader2, Pencil } from "lucide-react";

interface Prompt {
  id: string;
  text: string;
  level: string;
  source_file: string | null;
  created_at: string;
}

const levels = ["A1", "A2", "B1", "B2"];

export default function PromptsManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [filterLevel, setFilterLevel] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadLevel, setUploadLevel] = useState("A1");

  // Manual add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ text: "", level: "A1" });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("pronunciation_prompts").select("*").order("created_at", { ascending: false });
    if (filterLevel !== "all") q = q.eq("level", filterLevel);
    const { data } = await q;
    setPrompts((data as Prompt[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterLevel]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("level", uploadLevel);

      const { data, error } = await supabase.functions.invoke("parse-prompts", { body: formData });
      if (error) throw error;

      const parsed = data.prompts as { text: string; level: string }[];
      if (!parsed?.length) {
        toast.warning("Nenhum texto válido encontrado no arquivo.");
        return;
      }

      const rows = parsed.map((p) => ({ text: p.text, level: p.level, source_file: file.name }));
      const { error: insertErr } = await supabase.from("pronunciation_prompts").insert(rows);
      if (insertErr) throw insertErr;

      toast.success(`${rows.length} textos importados com sucesso!`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar arquivo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openAdd = () => { setEditId(null); setForm({ text: "", level: "A1" }); setDialogOpen(true); };
  const openEdit = (p: Prompt) => { setEditId(p.id); setForm({ text: p.text, level: p.level }); setDialogOpen(true); };

  const save = async () => {
    if (!form.text.trim()) { toast.error("Texto obrigatório."); return; }
    if (editId) {
      await supabase.from("pronunciation_prompts").update({ text: form.text.trim(), level: form.level }).eq("id", editId);
      toast.success("Texto atualizado.");
    } else {
      await supabase.from("pronunciation_prompts").insert({ text: form.text.trim(), level: form.level });
      toast.success("Texto adicionado.");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("pronunciation_prompts").delete().eq("id", id);
    toast.success("Removido.");
    load();
  };

  return (
    <div className="space-y-6">
      {/* Upload card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Importar Textos de Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nível</label>
            <Select value={uploadLevel} onValueChange={setUploadLevel}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Arquivo (.txt, .csv, .md)</label>
            <Input type="file" accept=".txt,.csv,.md,.text" onChange={handleFileUpload} disabled={uploading} />
          </div>
          {uploading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Filtrar nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Texto</TableHead>
              <TableHead className="w-20">Nível</TableHead>
              <TableHead className="w-32">Origem</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : prompts.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum texto cadastrado.</TableCell></TableRow>
            ) : prompts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-md truncate text-sm">{p.text}</TableCell>
                <TableCell><Badge variant="secondary">{p.level}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.source_file || "Manual"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover texto?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Texto" : "Novo Texto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Digite o texto para pronúncia…" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={4} />
            <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={save}>{editId ? "Salvar" : "Adicionar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
