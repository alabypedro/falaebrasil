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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase as sb } from "@/integrations/supabase/client";

interface Community {
  id: string;
  title: string;
  description: string | null;
  whatsapp_url: string | null;
  access_key: string;
  required_tier: "open" | "pro";
  sort_order: number;
}

const emptyForm = { title: "", description: "", whatsapp_url: "", access_key: "free", required_tier: "open" as "open" | "pro", sort_order: 0 };

const accessLabels: Record<string, string> = {
  free: "Grátis (todos)",
  a1: "Curso FB Básico PRO (A1)",
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

  // Plan tier por email
  const [tierEmail, setTierEmail] = useState("");
  const [tierValue, setTierValue] = useState<"open" | "pro" | "vip">("pro");
  const [tierBusy, setTierBusy] = useState(false);

  // Link do professor (VIP)
  const [teacherUrl, setTeacherUrl] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("fb_communities")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setItems(data as Community[]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    sb.from("vip_config").select("teacher_chat_url").eq("id", 1).maybeSingle()
      .then(({ data }) => setTeacherUrl(data?.teacher_chat_url ?? ""));
  }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, sort_order: items.length + 1 }); setOpen(true); };

  const openEdit = (item: Community) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      whatsapp_url: item.whatsapp_url ?? "",
      access_key: item.access_key,
      required_tier: item.required_tier ?? "open",
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
      required_tier: form.required_tier,
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

  const setTier = async () => {
    if (!tierEmail.trim()) { toast.error("Informe o email"); return; }
    setTierBusy(true);
    const { data: { session } } = await sb.auth.getSession();
    const { data, error } = await sb.functions.invoke("set-plan-tier-admin", {
      body: { email: tierEmail.trim(), tier: tierValue },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setTierBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao atualizar plano");
    } else {
      toast.success(`Plano ${tierValue.toUpperCase()} aplicado a ${tierEmail}`);
      setTierEmail("");
    }
  };

  const saveTeacherUrl = async () => {
    setTeacherBusy(true);
    const { error } = await sb.from("vip_config")
      .update({ teacher_chat_url: teacherUrl.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setTeacherBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Link do professor atualizado!");
  };

  return (
    <div className="space-y-4">
      {/* === Plano por email (OPEN/PRO/VIP) === */}
      <Card>
        <CardHeader><CardTitle className="text-base">Definir plano de um aluno por email</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <strong>OPEN</strong>: acesso a tudo, sem grupos WhatsApp. <strong>PRO</strong>: + grupos WhatsApp por nível. <strong>VIP</strong>: + chat 1:1 com o professor.
          </p>
          <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2">
            <Input
              type="email"
              value={tierEmail}
              onChange={(e) => setTierEmail(e.target.value)}
              placeholder="aluno@email.com"
            />
            <Select value={tierValue} onValueChange={(v: any) => setTierValue(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">OPEN</SelectItem>
                <SelectItem value="pro">PRO</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={setTier} disabled={tierBusy}>
              {tierBusy ? "Aplicando..." : "Aplicar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* === Link do professor (VIP) === */}
      <Card>
        <CardHeader><CardTitle className="text-base">Link de aula particular (VIP)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Link único usado por todos os alunos VIP para falar com o professor (WhatsApp, Calendly, etc).
          </p>
          <div className="flex gap-2">
            <Input
              value={teacherUrl}
              onChange={(e) => setTeacherUrl(e.target.value)}
              placeholder="https://wa.me/55... ou https://calendly.com/..."
            />
            <Button onClick={saveTeacherUrl} disabled={teacherBusy}>
              {teacherBusy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
              <TableHead>Plano mín.</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Link</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma comunidade cadastrada.</TableCell></TableRow>
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
                  <Badge variant={item.required_tier === "pro" ? "default" : "outline"} className="text-[10px] uppercase">
                    {item.required_tier ?? "open"}
                  </Badge>
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
                  <SelectItem value="a1">Curso FB Básico PRO (A1)</SelectItem>
                  <SelectItem value="a2">Curso A2</SelectItem>
                  <SelectItem value="b1">Curso B1</SelectItem>
                  <SelectItem value="b2">Curso B2</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define qual nível libera esta comunidade. Vinculado ao mesmo desbloqueio do curso.</p>
            </div>
            <div className="space-y-2">
              <Label>Plano mínimo</Label>
              <Select value={form.required_tier} onValueChange={(v: any) => setForm({ ...form, required_tier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">OPEN (todos)</SelectItem>
                  <SelectItem value="pro">PRO (apenas alunos PRO/VIP)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Alunos OPEN veem grupos PRO trancados com popup de upgrade. Alunos PRO/VIP veem grupos OPEN trancados sem popup.
              </p>
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
