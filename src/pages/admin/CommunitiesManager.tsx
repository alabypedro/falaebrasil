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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Community {
  id: string;
  title: string;
  description: string | null;
  whatsapp_url: string | null;
  access_key: string;
  sort_order: number;
}

const emptyForm = { title: "", description: "", whatsapp_url: "", access_key: "free", sort_order: 0 };

const accessLabels: Record<string, string> = {
  free: "Grátis (todos)",
  a1: "Curso A1 (Essencial Pro)",
  a2: "Curso A2",
  b1: "Curso B1",
  b2: "Curso B2",
};

export default function CommunitiesManager() {
  const [items, setItems] = useState<Community[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Community | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("fb_communities")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setItems(data as Community[]);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, sort_order: items.length + 1 }); setOpen(true); };

  const openEdit = (item: Community) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      whatsapp_url: item.whatsapp_url ?? "",
      access_key: item.access_key,
      sort_order: item.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    setLoading(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      whatsapp_url: form.whatsapp_url.trim() || null,
      access_key: form.access_key,
      sort_order: form.sort_order,
    };
    if (editing) {
      const { error } = await supabase.from("fb_communities").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Comunidade atualizada!");
    } else {
      const { error } = await supabase.from("fb_communities").insert(payload);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Comunidade criada!");
    }
    setOpen(false); setLoading(false); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("fb_communities").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Comunidade excluída"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Comunidades FB</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Comunidade</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Link</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma comunidade cadastrada.</TableCell></TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs text-muted-foreground">{item.sort_order}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    {item.title}
                  </div>
                  {item.description && <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={item.access_key === "free" ? "outline" : "default"} className="text-[10px]">
                    {accessLabels[item.access_key] ?? item.access_key}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.whatsapp_url ? <span>✅</span> : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir comunidade?</AlertDialogTitle><AlertDialogDescription>A comunidade será removida permanentemente.</AlertDialogDescription></AlertDialogHeader>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Comunidade" : "Nova Comunidade"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Lets Falaê" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (mostrada no popup)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Quizzes e músicas com letras" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Link do Grupo de WhatsApp</Label>
              <Input value={form.whatsapp_url} onChange={(e) => setForm({ ...form, whatsapp_url: e.target.value })} placeholder="https://chat.whatsapp.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Acesso requerido</Label>
              <Select value={form.access_key} onValueChange={(v) => setForm({ ...form, access_key: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Grátis (todos)</SelectItem>
                  <SelectItem value="a1">Curso A1 (Essencial Pro)</SelectItem>
                  <SelectItem value="a2">Curso A2</SelectItem>
                  <SelectItem value="b1">Curso B1</SelectItem>
                  <SelectItem value="b2">Curso B2</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define qual nível libera esta comunidade. Vinculado ao mesmo desbloqueio do curso.</p>
            </div>
            <div className="space-y-2">
              <Label>Ordem de exibição</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
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
