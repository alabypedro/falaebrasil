import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableRow } from "@/components/admin/SortableRow";

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  display_order: number;
  courses?: { title: string } | null;
}

interface Course { id: string; title: string; }

const emptyForm = { course_id: "", title: "", description: "", display_order: 0 };

export default function ModulesManager() {
  const [modules, setModules] = useState<Module[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    const [{ data: mods }, { data: crs }] = await Promise.all([
      supabase.from("modules").select("*, courses(title)").order("display_order"),
      supabase.from("courses").select("id, title").order("display_order"),
    ]);
    if (mods) setModules(mods);
    if (crs) setCourses(crs);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      const matchesCourse = filterCourse === "all" || m.course_id === filterCourse;
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           ((m.courses as any)?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      return matchesCourse && matchesSearch;
    });
  }, [modules, filterCourse, searchQuery]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, course_id: filterCourse !== "all" ? filterCourse : courses[0]?.id ?? "" }); setOpen(true); };

  const openEdit = (m: Module) => {
    setEditing(m);
    setForm({ course_id: m.course_id, title: m.title, description: m.description ?? "", display_order: m.display_order });
    setOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        const updates = newItems
          .filter(m => m.course_id === items[oldIndex].course_id)
          .map((item, idx) => ({ id: item.id, display_order: idx }));
        
        Promise.all(updates.map(u => supabase.from("modules").update({ display_order: u.display_order }).eq("id", u.id)))
          .then(() => toast.success("Ordem atualizada"));
          
        return newItems;
      });
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.course_id) { toast.error("Preencha todos os campos obrigatórios"); return; }
    setLoading(true);
    const payload = { course_id: form.course_id, title: form.title.trim(), description: form.description.trim() || null, display_order: form.display_order };

    if (editing) {
      const { error } = await supabase.from("modules").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Módulo atualizado!");
    } else {
      const { error } = await supabase.from("modules").insert(payload);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Módulo criado!");
    }
    setOpen(false); setLoading(false); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Módulo excluído"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold">Módulos</h2>
          <p className="text-sm text-muted-foreground">Gerencie as divisões dos cursos</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Módulo</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-lg border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar módulos..." 
            className="pl-9 h-9" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-48 h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cursos</SelectItem>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">Nenhum módulo encontrado.</TableCell></TableRow>
              )}
              <SortableContext items={filtered.map(m => m.id)} strategy={verticalListSortingStrategy}>
                {filtered.map((m) => (
                  <SortableRow key={m.id} id={m.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{m.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Order: {m.display_order}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{(m.courses as any)?.title ?? "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir módulo?</AlertDialogTitle><AlertDialogDescription>Lições e quizzes vinculados também serão excluídos.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(m.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </SortableRow>
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Módulo" : "Novo Módulo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Curso</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um curso" /></SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
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
