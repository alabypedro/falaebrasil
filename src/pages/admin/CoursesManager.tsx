import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImageIcon, Search, LayoutGrid, List, Filter, Eye, EyeOff } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableRow } from "@/components/admin/SortableRow";
import { BulkActions } from "@/components/admin/BulkActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  display_order: number;
  published: boolean;
  thumbnail_url: string | null;
  category: string;
  required_tier: string;
}

const levels = ["A1", "A2", "B1", "B2"];
const adultTiers = [
  { value: "open", label: "OPEN" },
  { value: "pro", label: "PRO" },
  { value: "vip", label: "VIP" },
];
const youthTiers = [
  { value: "teens", label: "TEENS" },
  { value: "kids", label: "KIDS" },
];

const emptyForm = { title: "", description: "", level: "A1", display_order: 0, published: false, thumbnail_url: "", category: "transversal", required_tier: "open" };

export default function CoursesManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    const { data } = await supabase.from("courses").select("*").order("display_order");
    if (data) setCourses(data);
  };

  useEffect(() => { load(); }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === "all" ? true : 
                           statusFilter === "published" ? c.published : !c.published;
      return matchesSearch && matchesStatus;
    });
  }, [courses, searchQuery, statusFilter]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (c: Course) => {
    setEditing(c);
    setForm({ title: c.title, description: c.description ?? "", level: c.level, display_order: c.display_order, published: c.published, thumbnail_url: c.thumbnail_url ?? "", category: c.category, required_tier: c.required_tier ?? "open" });
    setOpen(true);
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `thumbnails/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("lesson-files").upload(path, file);
    if (error) { toast.error("Erro no upload: " + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
    setForm({ ...form, thumbnail_url: data.publicUrl });
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    setLoading(true);
    const payload = { title: form.title.trim(), description: form.description.trim() || null, level: form.level, display_order: form.display_order, published: form.published, thumbnail_url: form.thumbnail_url.trim() || null, category: form.category, required_tier: form.required_tier };

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCourses((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update display_order in background
        const updates = newItems.map((item, idx) => ({
          id: item.id,
          display_order: idx
        }));
        
        Promise.all(updates.map(u => supabase.from("courses").update({ display_order: u.display_order }).eq("id", u.id)))
          .then(() => toast.success("Ordem atualizada"));
          
        return newItems;
      });
    }
  };

  const bulkPublish = async (status: boolean) => {
    const { error } = await supabase.from("courses").update({ published: status }).in("id", selectedIds);
    if (error) toast.error(error.message);
    else {
      toast.success(`Cursos ${status ? "publicados" : "em rascunho"}`);
      setSelectedIds([]);
      load();
    }
  };

  const bulkDelete = async () => {
    const { error } = await supabase.from("courses").delete().in("id", selectedIds);
    if (error) toast.error(error.message);
    else {
      toast.success("Cursos excluídos");
      setSelectedIds([]);
      load();
    }
  };

  const levelColor: Record<string, string> = {
    A1: "bg-emerald-100 text-emerald-700",
    A2: "bg-sky-100 text-sky-700",
    B1: "bg-amber-100 text-amber-700",
    B2: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Cursos</h2>
          <p className="text-sm text-muted-foreground">Gerencie o catálogo de cursos da plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Curso</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-lg border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar cursos..." 
            className="pl-9 h-9" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[150px] h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md p-1 bg-background">
          <Button 
            variant={viewMode === "table" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button 
            variant={viewMode === "grid" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="rounded-md border bg-card">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={selectedIds.length === filteredCourses.length && filteredCourses.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedIds(filteredCourses.map(c => c.id));
                        else setSelectedIds([]);
                      }}
                    />
                  </TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum curso encontrado.</TableCell></TableRow>
                )}
                <SortableContext items={filteredCourses.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  {filteredCourses.map((c) => (
                    <SortableRow key={c.id} id={c.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(c.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds([...selectedIds, c.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== c.id));
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {c.thumbnail_url ? (
                            <img src={c.thumbnail_url} alt="" className="h-10 w-10 rounded-md object-cover border" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center border">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p>{c.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">#{c.display_order}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={levelColor[c.level] ?? ""}>{c.level}</Badge></TableCell>
                      <TableCell>
                        {c.published ? (
                          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Publicado</Badge>
                        ) : (
                          <Badge variant="secondary">Rascunho</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir curso?</AlertDialogTitle><AlertDialogDescription>Isso também excluirá todos os módulos, lições e quizzes vinculados.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(c.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCourses.map((c) => (
            <Card key={c.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video relative bg-muted group">
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <Badge className={levelColor[c.level] ?? ""}>{c.level}</Badge>
                  {!c.published && <Badge variant="secondary" className="opacity-90">Rascunho</Badge>}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
                </div>
              </div>
              <CardHeader className="p-4 pb-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{c.title}</h3>
                  <Checkbox 
                    checked={selectedIds.includes(c.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds([...selectedIds, c.id]);
                      else setSelectedIds(selectedIds.filter(id => id !== c.id));
                    }}
                    className="mt-1"
                  />
                </div>
              </CardHeader>
              <CardFooter className="p-4 pt-2">
                <p className="text-xs text-muted-foreground line-clamp-2">{c.description || "Sem descrição"}</p>
              </CardFooter>
            </Card>
          ))}
          {filteredCourses.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum curso encontrado.</div>
          )}
        </div>
      )}

      <BulkActions 
        selectedCount={selectedIds.length} 
        onClear={() => setSelectedIds([])}
        onDelete={bulkDelete}
        onPublish={bulkPublish}
        label="cursos"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hierarquia (tier)</Label>
              <Select value={form.required_tier} onValueChange={(v) => setForm({ ...form, required_tier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Adultos (18+)</SelectLabel>
                    {adultTiers.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Crianças e adolescentes</SelectLabel>
                    {youthTiers.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Thumbnail do Curso</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="image/*" onChange={handleThumbnailUpload} disabled={uploading} />
                {form.thumbnail_url && <img src={form.thumbnail_url} alt="thumb" className="h-10 w-10 rounded object-cover" />}
              </div>
              {uploading && <p className="text-xs text-muted-foreground">Enviando...</p>}
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
