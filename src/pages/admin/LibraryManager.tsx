import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mic, Users, Loader2 } from "lucide-react";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

interface BstProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pdf_url: string | null;
  secondary_tool: "falae" | "leiae";
  checkout_url: string | null;
  price_cents: number;
  active: boolean;
  display_order: number;
}

interface Script {
  id: string;
  bst_product_id: string;
  title: string;
  script_text: string;
  level: string;
  display_order: number;
}

interface AccessRow {
  id: string;
  user_id: string;
  product_id: string;
  granted_at: string;
}

interface PaymentProduct {
  id: string;
  product_key: string;
  name: string | null;
  checkout_url: string | null;
  grants_bst_product_id: string | null;
}

const emptyForm = {
  title: "",
  slug: "",
  description: "",
  pdf_url: "",
  secondary_tool: "falae" as "falae" | "leiae",
  checkout_url: "",
  price_cents: 0,
  active: true,
  display_order: 0,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function LibraryManager() {
  const [products, setProducts] = useState<BstProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<BstProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // payment products (ASAAS)
  const [payProducts, setPayProducts] = useState<PaymentProduct[]>([]);
  const [payKey, setPayKey] = useState<string>("none");

  // scripts
  const [scriptsProduct, setScriptsProduct] = useState<BstProduct | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scriptForm, setScriptForm] = useState({ id: "", title: "", script_text: "", level: "A1", display_order: 0 });

  // access
  const [accessProduct, setAccessProduct] = useState<BstProduct | null>(null);
  const [accessRows, setAccessRows] = useState<(AccessRow & { email?: string | null })[]>([]);
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("bst_products").select("*").order("display_order").order("title");
    setProducts((data as BstProduct[]) || []);
    const { data: pp } = await supabase
      .from("payment_products")
      .select("id,product_key,name,checkout_url,grants_bst_product_id")
      .order("product_key");
    setPayProducts((pp as any as PaymentProduct[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setPayKey("none"); setForm({ ...emptyForm, display_order: products.length }); setDialog(true); };
  const openEdit = (p: BstProduct) => {
    setEditing(p);
    setPayKey(payProducts.find((pp) => pp.grants_bst_product_id === p.id)?.product_key ?? "none");
    setForm({
      title: p.title,
      slug: p.slug,
      description: p.description ?? "",
      pdf_url: p.pdf_url ?? "",
      secondary_tool: p.secondary_tool,
      checkout_url: p.checkout_url ?? "",
      price_cents: p.price_cents,
      active: p.active,
      display_order: p.display_order,
    });
    setDialog(true);
  };

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `bst/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("lesson-files").upload(path, file);
    if (error) { toast.error("Erro no upload: " + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
    setForm((f) => ({ ...f, pdf_url: data.publicUrl }));
    setUploading(false);
    toast.success("PDF enviado!");
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: (form.slug.trim() || slugify(form.title)).trim(),
      description: form.description.trim() || null,
      pdf_url: form.pdf_url.trim() || null,
      secondary_tool: form.secondary_tool,
      checkout_url: form.checkout_url.trim() || null,
      price_cents: Number(form.price_cents) || 0,
      active: form.active,
      display_order: Number(form.display_order) || 0,
    };
    let productId = editing?.id ?? null;
    let error: any = null;
    if (editing) {
      ({ error } = await supabase.from("bst_products").update(payload).eq("id", editing.id));
    } else {
      const res = await supabase.from("bst_products").insert(payload).select("id").single();
      error = res.error;
      productId = (res.data as any)?.id ?? null;
    }

    // vincula (ou desvincula) o produto de pagamento ASAAS
    if (!error && productId) {
      const previous = payProducts.find((pp) => pp.grants_bst_product_id === productId);
      if (previous && previous.product_key !== payKey) {
        await supabase.from("payment_products").update({ grants_bst_product_id: null }).eq("id", previous.id);
      }
      if (payKey !== "none") {
        const chosen = payProducts.find((pp) => pp.product_key === payKey);
        if (chosen) {
          await supabase.from("payment_products").update({ grants_bst_product_id: productId }).eq("id", chosen.id);
        }
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Produto atualizado" : "Produto criado");
    setDialog(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("bst_products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Produto removido"); load(); }
  };

  const toggleActive = async (p: BstProduct) => {
    const { error } = await supabase.from("bst_products").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else load();
  };

  // ---- scripts ----
  const openScripts = async (p: BstProduct) => {
    setScriptsProduct(p);
    setScriptForm({ id: "", title: "", script_text: "", level: "A1", display_order: 0 });
    const { data } = await supabase.from("bst_voice_scripts").select("*").eq("bst_product_id", p.id).order("display_order");
    setScripts((data as Script[]) || []);
  };

  const saveScript = async () => {
    if (!scriptsProduct) return;
    if (!scriptForm.title.trim() || !scriptForm.script_text.trim()) { toast.error("Título e script são obrigatórios"); return; }
    const payload = {
      bst_product_id: scriptsProduct.id,
      title: scriptForm.title.trim(),
      script_text: scriptForm.script_text.trim(),
      level: scriptForm.level,
      display_order: Number(scriptForm.display_order) || 0,
    };
    const { error } = scriptForm.id
      ? await supabase.from("bst_voice_scripts").update(payload).eq("id", scriptForm.id)
      : await supabase.from("bst_voice_scripts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Script salvo");
    openScripts(scriptsProduct);
  };

  const removeScript = async (id: string) => {
    const { error } = await supabase.from("bst_voice_scripts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else if (scriptsProduct) openScripts(scriptsProduct);
  };

  // ---- access ----
  const openAccess = async (p: BstProduct) => {
    setAccessProduct(p);
    setGrantEmail("");
    const { data } = await supabase.from("bst_product_access").select("*").eq("product_id", p.id).order("granted_at", { ascending: false });
    const rows = (data as AccessRow[]) || [];
    const ids = rows.map((r) => r.user_id);
    let emails: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,email").in("user_id", ids);
      ((profs as any[]) || []).forEach((pr) => { emails[pr.user_id] = pr.email; });
    }
    setAccessRows(rows.map((r) => ({ ...r, email: emails[r.user_id] })));
  };

  const grant = async () => {
    if (!accessProduct || !grantEmail.trim()) return;
    setGranting(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", grantEmail.trim().toLowerCase())
      .maybeSingle();
    if (!prof) { setGranting(false); toast.error("Aluno não encontrado com esse email."); return; }
    const { error } = await supabase.from("bst_product_access").insert({
      user_id: (prof as any).user_id,
      product_id: accessProduct.id,
      source: "admin",
    });
    setGranting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Acesso liberado!");
    openAccess(accessProduct);
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("bst_product_access").delete().eq("id", id);
    if (error) toast.error(error.message);
    else if (accessProduct) openAccess(accessProduct);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Biblioteca BST — Produtos Low-Ticket</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Cada produto BST tem PDF (com download), IA Memorizaê própria e IA Falaê (scripted) ou IA Leiaê.
            Vincule os baralhos do Memorizaê e os textos do Leiaê ao produto nas abas IA Memorizaê / IA Leiaê.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Produtos BST ({products.length})</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo produto BST</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-32">2ª ferramenta</TableHead>
                <TableHead className="w-24">PDF</TableHead>
                <TableHead className="w-24">Ativo</TableHead>
                <TableHead className="text-right w-48">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum produto BST ainda.</TableCell></TableRow>
              )}
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">/library/{p.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.secondary_tool === "leiae" ? "IA Leiaê" : "IA Falaê"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{p.pdf_url ? "📄" : "—"}</TableCell>
                  <TableCell><Switch checked={p.active} onCheckedChange={() => toggleActive(p)} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    {p.secondary_tool === "falae" && (
                      <Button variant="ghost" size="icon" title="Scripts do IA Falaê" onClick={() => openScripts(p)}>
                        <Mic className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Liberar acesso a alunos" onClick={() => openAccess(p)}>
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{p.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Scripts, baralhos e textos vinculados a este produto também serão removidos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar produto BST" : "Novo produto BST"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })}
                placeholder="BST Guia de Sobrevivência 50+"
              />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>2ª ferramenta</Label>
                <Select value={form.secondary_tool} onValueChange={(v: "falae" | "leiae") => setForm({ ...form, secondary_tool: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="falae">IA Falaê (scripted)</SelectItem>
                    <SelectItem value="leiae">IA Leiaê</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preço (centavos)</Label>
                <Input type="number" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: parseInt(e.target.value || "0", 10) })} />
              </div>
            </div>
            <div>
              <Label>Link de checkout (ASAAS)</Label>
              <Input value={form.checkout_url} onChange={(e) => setForm({ ...form, checkout_url: e.target.value })} placeholder="https://www.asaas.com/c/..." />
            </div>
            <div>
              <Label>Produto de pagamento (libera acesso automático)</Label>
              <Select value={payKey} onValueChange={setPayKey}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {payProducts.map((pp) => (
                    <SelectItem key={pp.id} value={pp.product_key}>
                      {pp.name || pp.product_key} ({pp.product_key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Ao confirmar o pagamento desse produto no ASAAS, o aluno recebe acesso a este BST automaticamente.
              </p>
            </div>
            <div>
              <Label>PDF do produto</Label>
              <Input type="file" accept="application/pdf" onChange={uploadPdf} disabled={uploading} />
              {uploading && <p className="text-xs text-muted-foreground">Enviando...</p>}
              {form.pdf_url && <p className="text-xs text-muted-foreground break-all mt-1">{form.pdf_url}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value || "0", 10) })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Ativo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scripts dialog */}
      <Dialog open={!!scriptsProduct} onOpenChange={(o) => !o && setScriptsProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Scripts IA Falaê — {scriptsProduct?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Input className="col-span-2" placeholder="Título do script" value={scriptForm.title} onChange={(e) => setScriptForm({ ...scriptForm, title: e.target.value })} />
              <Select value={scriptForm.level} onValueChange={(v) => setScriptForm({ ...scriptForm, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Textarea rows={3} placeholder="Frase / script em inglês" value={scriptForm.script_text} onChange={(e) => setScriptForm({ ...scriptForm, script_text: e.target.value })} />
            <div className="flex gap-2">
              <Input type="number" className="w-28" placeholder="Ordem" value={scriptForm.display_order} onChange={(e) => setScriptForm({ ...scriptForm, display_order: parseInt(e.target.value || "0", 10) })} />
              <Button onClick={saveScript}>{scriptForm.id ? "Atualizar script" : "Adicionar script"}</Button>
              {scriptForm.id && (
                <Button variant="outline" onClick={() => setScriptForm({ id: "", title: "", script_text: "", level: "A1", display_order: scripts.length })}>Novo</Button>
              )}
            </div>
            <div className="rounded-md border divide-y">
              {scripts.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum script ainda.</p>}
              {scripts.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.script_text}</div>
                  </div>
                  <Badge variant="outline">{s.level}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => setScriptForm({ id: s.id, title: s.title, script_text: s.script_text, level: s.level, display_order: s.display_order })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeScript(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access dialog */}
      <Dialog open={!!accessProduct} onOpenChange={(o) => !o && setAccessProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Acessos — {accessProduct?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="email do aluno" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} />
              <Button onClick={grant} disabled={granting || !grantEmail.trim()}>Liberar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Alunos OPEN, PRO e VIP já têm acesso a todos os produtos BST automaticamente.
            </p>
            <div className="rounded-md border divide-y max-h-72 overflow-auto">
              {accessRows.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum aluno liberado manualmente.</p>}
              {accessRows.map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-3 text-sm">
                  <span className="flex-1 truncate">{r.email ?? r.user_id}</span>
                  <Button variant="ghost" size="icon" onClick={() => revoke(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
