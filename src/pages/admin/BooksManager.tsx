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
import { BookText, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { LEVELS, type Level } from "@/lib/levels";

interface BookText {
  id: string;
  title: string;
  author: string | null;
  content: string;
  audio_url: string | null;
  level: Level;
  display_order: number;
}

export default function BooksManager() {
  const [items, setItems] = useState<BookText[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Level | "all">("all");
  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<BookText | null>(null);
  const [form, setForm] = useState<{ title: string; author: string; content: string; audio_url: string; level: Level; display_order: number }>({
    title: "", author: "", content: "", audio_url: "", level: "A1", display_order: 0,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("book_texts" as any).select("*").order("level").order("display_order");
    setItems((data as unknown as BookText[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", author: "", content: "", audio_url: "", level: "A1", display_order: items.length });
    setDialog(true);
  };
  const openEdit = (x: BookText) => {
    setEditing(x);
    setForm({
      title: x.title, author: x.author ?? "", content: x.content,
      audio_url: x.audio_url ?? "", level: x.level, display_order: x.display_order,
    });
    setDialog(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error("Título e texto são obrigatórios"); return; }
    const payload = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      content: form.content.trim(),
      audio_url: form.audio_url.trim() || null,
      level: form.level,
      display_order: form.display_order,
    };
    const { error } = editing
      ? await supabase.from("book_texts" as any).update(payload).eq("id", editing.id)
      : await supabase.from("book_texts" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Livro atualizado" : "Livro criado");
    setDialog(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("book_texts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Livro removido");
    load();
  };

  const filtered = items
    .filter((x) => (filter === "all" ? true : x.level === filter))
    .filter((x) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return x.title.toLowerCase().includes(q) || (x.author ?? "").toLowerCase().includes(q) || x.content.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.title.localeCompare(b.title, "pt-BR", { numeric: true });
    });

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookText className="h-4 w-4 text-primary" /> Livros e audio-livros — Bibliotecaê de Textos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Cadastre contos e capítulos em inglês para leitura interativa. Cada texto tem um nível de
            dificuldade (A1 → C2, K1 → K4, T1 → T4) e pode ter um áudio (audiolivro) opcional.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, autor ou texto..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo livro</Button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todos</Button>
          {LEVELS.map((lv) => (
            <Button key={lv} size="sm" variant={filter === lv ? "default" : "outline"} onClick={() => setFilter(lv)}>{lv}</Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} de {items.length} livros</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum livro {filter !== "all" ? `no nível ${filter}` : "ainda"}.</CardContent></Card>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="w-20">Nível</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Trecho</TableHead>
                <TableHead className="w-20">Áudio</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.title}</TableCell>
                  <TableCell><Badge variant="outline">{x.level}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{x.author ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">{x.content.slice(0, 120)}…</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{x.audio_url ? "Sim" : "—"}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar livro" : "Novo livro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: The Gift of the Magi" />
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
                <Label>Autor (opcional)</Label>
                <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Ex.: O. Henry" />
              </div>
            </div>
            <div>
              <Label>Texto em inglês</Label>
              <Textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Cole aqui o conto ou capítulo…"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label>Áudio (URL .mp3, opcional)</Label>
              <Input value={form.audio_url} onChange={(e) => setForm({ ...form, audio_url: e.target.value })} placeholder="https://archive.org/download/…" />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value || "0", 10) })} />
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
