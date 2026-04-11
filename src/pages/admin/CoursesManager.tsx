import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  display_order: number;
  published: boolean;
  thumbnail_url: string | null;
}

const levels = ["A1", "A2", "B1", "B2"];

const emptyForm = { title: "", description: "", level: "A1", display_order: 0, published: false, thumbnail_url: "" };

export default function CoursesManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("courses").select("*").order("display_order");
    if (data) setCourses(data);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (c: Course) => {
    setEditing(c);
    setForm({ title: c.title, description: c.description ?? "", level: c.level, display_order: c.display_order, published: c.published, thumbnail_url: c.thumbnail_url ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    setLoading(true);
    const payload = { title: form.title.trim(), description: form.description.trim() || null, level: form.level, display_order: form.display_order, published: form.published, thumbnail_url: form.thumbnail_url.trim() || null };

    if (editing) {
      const { error } = await supabase.from("courses").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Curso atualizado!");
    } else {
      const { error } = await supabase.from("courses").insert(payload);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Curso criado!");
    }

    setOpen(false);
    setLoading(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Curso excluído"); load(); }
  };

  const levelColor: Record<string, string> = {
    A1: "bg-emerald-100 text-emerald-700",
    A2: "bg-sky-100 text-sky-700",
    B1: "bg-amber-100 text-amber-700",
    B2: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cursos</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Curso</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum curso cadastrado.</TableCell></TableRow>
            )}
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.display_order}</TableCell>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell><Badge className={levelColor[c.level] ?? ""}>{c.level}</Badge></TableCell>
                <TableCell>{c.published ? <Badge variant="default">Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
                        <AlertDialogDescription>Isso também excluirá todos os módulos, lições e quizzes vinculados.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(c.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Curso" : "Novo Curso"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Inglês para Negócios" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição do curso..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL Thumbnail</Label>
              <Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
              <Label>Publicado</Label>
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
