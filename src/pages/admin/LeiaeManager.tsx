import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BookText, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { LEVELS, type Level } from "@/lib/levels";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { compareCourses, courseLabel, segmentGroupOf, sortCourses, SEGMENT_GROUP_ORDER } from "@/lib/courseOrder";
import { Search } from "lucide-react";

interface LeiaeText {
  id: string;
  title: string;
  content: string;
  level: Level;
  course_id: string | null;
  bst_product_id: string | null;
  display_order: number;
  unit: number | null;
}
interface Course { id: string; title: string; level?: string | null }
interface BstProduct { id: string; title: string; }

export default function LeiaeManager() {
  const [items, setItems] = useState<LeiaeText[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bstProducts, setBstProducts] = useState<BstProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Level | "all">("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<LeiaeText | null>(null);
  const [form, setForm] = useState<{ title: string; content: string; level: Level; course_id: string; bst_product_id: string; display_order: number; unit: string; }>({
    title: "", content: "", level: "A1", course_id: "none", bst_product_id: "none", display_order: 0, unit: "none",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: xs }, { data: cs }, { data: bp }] = await Promise.all([
      supabase.from("leiae_texts").select("*").order("level").order("display_order"),
      supabase.from("courses").select("id,title,level").order("display_order"),
      supabase.from("bst_products").select("id,title").order("display_order"),
    ]);
    setItems((xs as LeiaeText[]) || []);
    setCourses(sortCourses(((cs as Course[]) || [])));
    setBstProducts((bp as BstProduct[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", content: "", level: "A1", course_id: "none", bst_product_id: "none", display_order: items.length, unit: "none" });
    setDialog(true);
  };
  const openEdit = (x: LeiaeText) => {
    setEditing(x);
    setForm({
      title: x.title, content: x.content, level: x.level,
      course_id: x.course_id ?? "none", bst_product_id: x.bst_product_id ?? "none", display_order: x.display_order,
      unit: x.unit ? String(x.unit) : "none",
    });
    setDialog(true);
  };
  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error("Título e texto são obrigatórios"); return; }
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      level: form.level,
      course_id: form.course_id === "none" ? null : form.course_id,
      bst_product_id: form.bst_product_id === "none" ? null : form.bst_product_id,
      display_order: form.display_order,
      unit: form.unit === "none" ? null : parseInt(form.unit, 10),
    };
    const { error } = editing
      ? await supabase.from("leiae_texts").update(payload).eq("id", editing.id)
      : await supabase.from("leiae_texts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Texto atualizado" : "Texto criado");
    setDialog(false);
    load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("leiae_texts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Texto removido");
    load();
  };

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: courseLabel(c),
    group: segmentGroupOf(c),
    keywords: `${c.title} ${c.level ?? ""}`,
  }));

  const courseById = new Map(courses.map((c) => [c.id, c]));

  const filtered = items
    .filter((x) => (filter === "all" ? true : x.level === filter))
    .filter((x) => (courseFilter === "all" ? true : courseFilter === "none" ? !x.course_id : x.course_id === courseFilter))
    .filter((x) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const course = x.course_id ? courseById.get(x.course_id) : undefined;
      return x.title.toLowerCase().includes(q) || x.content.toLowerCase().includes(q) || (course?.title ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const ca = a.course_id ? courseById.get(a.course_id) : undefined;
      const cb = b.course_id ? courseById.get(b.course_id) : undefined;
      if (ca && cb) {
        const c = compareCourses(ca, cb);
        if (c !== 0) return c;
      } else if (ca || cb) {
        return ca ? -1 : 1;
      }
      if ((a.unit ?? 0) !== (b.unit ?? 0)) return (a.unit ?? 0) - (b.unit ?? 0);
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.title.localeCompare(b.title, "pt-BR", { numeric: true });
    });

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookText className="h-4 w-4 text-primary" /> IA Leiaê — Bibliotecaê de Textos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Cadastre textos técnicos (relatórios, e-mails, guias) para o aluno ler de forma interativa.
            Cada texto tem um nível de dificuldade (A1 → C2) — o aluno filtra por nível na página do IA Leiaê,
            igual ao IA Escreveaê.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, curso ou texto..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-56">
          <SearchableSelect
            className="h-9"
            value={courseFilter}
            onChange={setCourseFilter}
            groupOrder={SEGMENT_GROUP_ORDER}
            searchPlaceholder="Buscar curso..."
            options={[
              { value: "all", label: "Todos os cursos" },
              { value: "none", label: "Sem curso (global)" },
              ...courseOptions,
            ]}
          />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo texto</Button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            Todos
          </Button>
          {LEVELS.map((lv) => (
            <Button
              key={lv}
              size="sm"
              variant={filter === lv ? "default" : "outline"}
              onClick={() => setFilter(lv)}
            >
              {lv}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} de {items.length} textos</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum texto {filter !== "all" ? `no nível ${filter}` : "ainda"}.</CardContent></Card>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="w-20">Nível</TableHead>
                <TableHead className="w-20">Unidade</TableHead>
                <TableHead>Trecho</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((x) => {
                const course = courses.find((c) => c.id === x.course_id);
                return (
                  <TableRow key={x.id}>
                    <TableCell className="font-medium">{x.title}</TableCell>
                    <TableCell><Badge variant="outline">{x.level}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{x.unit ? `Unit ${x.unit}` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">{x.content.slice(0, 120)}…</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{course ? courseLabel(course) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(x)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover "{x.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(x.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar texto" : "Novo texto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Auditoria Q3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nível de dificuldade</Label>
                <Select value={form.level} onValueChange={(v: Level) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{lv}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Curso vinculado (opcional)</Label>
                <SearchableSelect
                  value={form.course_id}
                  onChange={(v) => setForm({ ...form, course_id: v })}
                  searchPlaceholder="Buscar curso..."
                  groupOrder={SEGMENT_GROUP_ORDER}
                  options={[{ value: "none", label: "Nenhum (global)" }, ...courseOptions]}
                />
              </div>
            </div>
            <div>
              <Label>Unidade (produtos BST com Unit 1–12)</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((u) => (
                    <SelectItem key={u} value={String(u)}>Unit {u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Texto em inglês (baseado num PDF, e-mail, guia…)</Label>
              <Textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Cole aqui o texto extraído do PDF ou digitado…"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value || "0", 10) })} />
            </div>
            <div>
              <Label>Produto BST (opcional)</Label>
              <Select value={form.bst_product_id} onValueChange={(v) => setForm({ ...form, bst_product_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (plataforma FB)</SelectItem>
                  {bstProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Ao vincular, o texto aparece só dentro do produto BST.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}