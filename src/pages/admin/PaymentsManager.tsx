import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, ExternalLink, Copy, Plus, Trash2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ASAAS_WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/asaas-webhook`;
const HUBLA_WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/hubla-webhook`;

type PaymentProduct = {
  id: string;
  product_key: string;
  name: string;
  description: string | null;
  type: "subscription" | "one_time";
  billing_cycle: "MONTHLY" | "YEARLY" | "WEEKLY" | "QUARTERLY" | "SEMIANNUALLY" | null;
  price_cents: number;
  plan_tier: string | null;
  active: boolean;
  display_order: number;
  grants_course_access: boolean;
  grants_ebook1_access: boolean;
  grants_ebook2_access: boolean;
  grants_ebook3_access: boolean;
  grants_scripted_seconds: number;
  grants_unscripted_seconds: number;
};

type CourseRow = { id: string; title: string; level: string; required_tier: string };

type SubscriptionRow = {
  id: string;
  asaas_subscription_id: string;
  product_key: string;
  status: string;
  cycle: string | null;
  value_cents: number;
  next_due_date: string | null;
  canceled_at: string | null;
  user_id: string;
  created_at: string;
  email?: string | null;
  display_name?: string | null;
};

type PaymentRow = {
  id: string;
  asaas_payment_id: string;
  asaas_subscription_id: string | null;
  product_key: string | null;
  status: string;
  billing_type: string | null;
  value_cents: number;
  due_date: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  user_id: string | null;
  email?: string | null;
  display_name?: string | null;
};

const emptyProduct: PaymentProduct = {
  id: "",
  product_key: "",
  name: "",
  description: "",
  type: "one_time",
  billing_cycle: null,
  price_cents: 0,
  plan_tier: "",
  active: true,
  display_order: 0,
  grants_course_access: false,
  grants_ebook1_access: false,
  grants_ebook2_access: false,
  grants_ebook3_access: false,
  grants_scripted_seconds: 0,
  grants_unscripted_seconds: 0,
};

export default function PaymentsManager() {
  const [activeTab, setActiveTab] = useState("produtos");
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [productCourses, setProductCourses] = useState<Record<string, Set<string>>>({});
  const [draft, setDraft] = useState<PaymentProduct | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [hublaItems, setHublaItems] = useState<any[]>([]);
  const [hublaCourses, setHublaCourses] = useState<Record<string, Set<string>>>({});

  const loadProducts = async () => {
    const [{ data: p }, { data: c }, { data: links }] = await Promise.all([
      supabase.from("payment_products").select("*").order("display_order"),
      supabase.from("courses").select("id, title, level, required_tier").eq("published", true).order("display_order"),
      supabase.from("payment_product_courses").select("product_id, course_id"),
    ]);
    if (p) setProducts(p as PaymentProduct[]);
    if (c) setCourses(c);
    if (links) {
      const map: Record<string, Set<string>> = {};
      for (const row of links as any[]) {
        if (!map[row.product_id]) map[row.product_id] = new Set();
        map[row.product_id].add(row.course_id);
      }
      setProductCourses(map);
    }
  };

  const loadSubscriptions = async () => {
    const { data } = await supabase
      .from("asaas_subscriptions")
      .select("*, profiles(email, display_name)")
      .order("created_at", { ascending: false });
    if (data) {
      setSubscriptions(
        data.map((s: any) => ({
          ...s,
          email: s.profiles?.email ?? null,
          display_name: s.profiles?.display_name ?? null,
        })) as SubscriptionRow[],
      );
    }
  };

  const loadPayments = async () => {
    const { data } = await supabase
      .from("asaas_payments")
      .select("*, profiles(email, display_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      setPayments(
        data.map((p: any) => ({
          ...p,
          email: p.profiles?.email ?? null,
          display_name: p.profiles?.display_name ?? null,
        })) as PaymentRow[],
      );
    }
  };

  const loadHubla = async () => {
    const [{ data: items }, { data: links }, { data: courseData }] = await Promise.all([
      supabase.from("hubla_product_mapping").select("*").order("price_cents", { ascending: false }),
      supabase.from("hubla_product_courses").select("product_mapping_id, course_id"),
      supabase.from("courses").select("id, title, level, required_tier").eq("published", true).order("display_order"),
    ]);
    if (items) setHublaItems(items.filter((p: any) => p.product_key !== "plano_pro" && p.product_key !== "plano_vip"));
    if (courseData) setCourses(courseData);
    if (links) {
      const map: Record<string, Set<string>> = {};
      for (const row of links as any[]) {
        if (!map[row.product_mapping_id]) map[row.product_mapping_id] = new Set();
        map[row.product_mapping_id].add(row.course_id);
      }
      setHublaCourses(map);
    }
  };

  useEffect(() => {
    loadProducts();
    loadHubla();
  }, []);

  useEffect(() => {
    if (activeTab === "assinaturas") loadSubscriptions();
    if (activeTab === "pagamentos") loadPayments();
  }, [activeTab]);

  const isEditing = !!draft;
  const draftIsNew = draft?.id === "__new__";

  const upsertProduct = async () => {
    if (!draft) return;
    if (!draft.product_key.trim() || !draft.name.trim()) {
      toast.error("Chave e nome do produto são obrigatórios");
      return;
    }
    setLoading(true);
    const payload = {
      product_key: draft.product_key.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      type: draft.type,
      billing_cycle: draft.type === "subscription" ? draft.billing_cycle : null,
      price_cents: draft.price_cents,
      plan_tier: draft.plan_tier?.trim() || null,
      active: draft.active,
      display_order: draft.display_order,
      grants_course_access: draft.grants_course_access,
      grants_ebook1_access: draft.grants_ebook1_access,
      grants_ebook2_access: draft.grants_ebook2_access,
      grants_ebook3_access: draft.grants_ebook3_access,
      grants_scripted_seconds: draft.grants_scripted_seconds,
      grants_unscripted_seconds: draft.grants_unscripted_seconds,
    };

    if (draftIsNew) {
      const { data, error } = await supabase.from("payment_products").insert(payload).select("id").single();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      draft.id = data.id;
    } else {
      const { error } = await supabase.from("payment_products").update(payload).eq("id", draft.id);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
    }

    // sync courses
    const selected = Array.from(productCourses[draft.id] ?? []);
    await supabase.from("payment_product_courses").delete().eq("product_id", draft.id);
    if (selected.length > 0) {
      const rows = selected.map((cid) => ({ product_id: draft.id, course_id: cid }));
      await supabase.from("payment_product_courses").insert(rows);
    }

    toast.success("Produto salvo!");
    setDraft(null);
    setLoading(false);
    loadProducts();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("payment_products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produto removido");
    loadProducts();
  };

  const toggleProductCourse = (productId: string, courseId: string, checked: boolean) => {
    setProductCourses((prev) => {
      const next = { ...prev };
      const set = new Set(next[productId] ?? []);
      if (checked) set.add(courseId); else set.delete(courseId);
      next[productId] = set;
      return next;
    });
  };

  const cancelSubscription = async (subscriptionId: string) => {
    setCancelingId(subscriptionId);
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-cancel-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Erro ao cancelar");
      } else {
        toast.success("Assinatura cancelada no ASAAS");
        loadSubscriptions();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const priceLabel = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

  const statusBadge = (status: string) => {
    const cls = cn(
      "text-[10px] uppercase font-semibold",
      status === "ACTIVE" || status === "RECEIVED" || status === "CONFIRMED"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
        : status === "PENDING" || status === "AWAITING_RISK_ANALYSIS"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
        : status === "OVERDUE" || status === "CANCELED" || status === "REFUNDED"
        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    );
    return <Badge className={cls}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pagamentos ASAAS</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie produtos, acompanhe assinaturas e pagamentos, e configure o webhook do ASAAS.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="hubla">Legado Hubla</TabsTrigger>
        </TabsList>

        {/* PRODUTOS */}
        <TabsContent value="produtos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Catálogo de produtos</h3>
            <Button
              size="sm"
              onClick={() => setDraft({ ...emptyProduct, id: "__new__" })}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Novo produto
            </Button>
          </div>

          <div className="grid gap-4">
            {products.map((p) => (
              <Card key={p.id} className={cn(!p.active && "opacity-70")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {p.name}
                      <Badge variant="outline" className="text-[10px] uppercase">{p.type}</Badge>
                      {p.active || <Badge variant="secondary">Inativo</Badge>}
                    </span>
                    <span className="text-sm font-mono">{priceLabel(p.price_cents)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Chave do produto</Label>
                      <Input
                        value={p.product_key}
                        readOnly
                        className="font-mono text-xs bg-muted"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tier do plano</Label>
                      <Input
                        value={p.plan_tier ?? ""}
                        readOnly
                        className="text-xs bg-muted"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ciclo</Label>
                      <Input
                        value={p.billing_cycle ?? "—"}
                        readOnly
                        className="text-xs bg-muted"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.grants_course_access && <Badge>Curso</Badge>}
                    {p.grants_ebook1_access && <Badge>Ebook 1</Badge>}
                    {p.grants_ebook2_access && <Badge>Ebook 2</Badge>}
                    {p.grants_ebook3_access && <Badge>Ebook 3</Badge>}
                    {p.grants_scripted_seconds > 0 && (
                      <Badge variant="outline">+{p.grants_scripted_seconds}s roteiro</Badge>
                    )}
                    {p.grants_unscripted_seconds > 0 && (
                      <Badge variant="outline">+{p.grants_unscripted_seconds}s livre</Badge>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDraft(p)}>
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso não afeta compras já feitas, apenas remove do catálogo de novos checkouts.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteProduct(p.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
            )}
          </div>
        </TabsContent>

        {/* ASSINATURAS */}
        <TabsContent value="assinaturas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Assinaturas ASAAS</h3>
            <Button variant="outline" size="sm" onClick={loadSubscriptions}>
              Atualizar
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Próximo venc.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{s.display_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.email || s.user_id}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.product_key}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-xs">{priceLabel(s.value_cents)}</TableCell>
                    <TableCell className="text-xs">
                      {s.next_due_date ? new Date(s.next_due_date).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status !== "CANCELED" ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancelingId === s.asaas_subscription_id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O aluno perderá o acesso no próximo ciclo. Essa ação não pode ser desfeita no ASAAS.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelSubscription(s.asaas_subscription_id)}
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-xs text-muted-foreground">Cancelada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                      Nenhuma assinatura encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PAGAMENTOS */}
        <TabsContent value="pagamentos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Pagamentos ASAAS</h3>
            <Button variant="outline" size="sm" onClick={loadPayments}>
              Atualizar
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{p.display_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.email || p.user_id || "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{p.product_key || "—"}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-xs">{p.billing_type || "—"}</TableCell>
                    <TableCell className="text-xs">{priceLabel(p.value_cents)}</TableCell>
                    <TableCell className="text-xs">
                      {p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.invoice_url ? (
                        <Button asChild variant="ghost" size="icon">
                          <a href={p.invoice_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                      Nenhum pagamento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* WEBHOOK */}
        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook ASAAS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs">URL para configurar no painel do ASAAS</Label>
              <div className="flex gap-2">
                <Input value={ASAAS_WEBHOOK_URL} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(ASAAS_WEBHOOK_URL)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole esta URL no ASAAS em <strong>Configurações → Webhooks</strong>. Configure o token
                <code> ASAAS_WEBHOOK_TOKEN</code> e envie os eventos de pagamento/assinatura.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eventos recomendados no ASAAS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>• PAYMENT_RECEIVED (libera acesso)</p>
              <p>• PAYMENT_OVERDUE (entra na carência)</p>
              <p>• SUBSCRIPTION_DELETED / SUBSCRIPTION_CANCELLED (cancela acesso)</p>
              <p>• PAYMENT_REFUNDED / PAYMENT_CHARGEBACK (reverte acesso)</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEGADO HUBLAS */}
        <TabsContent value="hubla" className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Vendas Hubla (somente leitura)</h3>
            <p className="text-xs text-muted-foreground">
              Histórico legado. Novos checkouts devem usar a aba <strong>Produtos</strong> do ASAAS.
            </p>
          </div>
          <div className="grid gap-4">
            {hublaItems.map((item) => (
              <Card key={item.id} className="opacity-70">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{item.display_name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{item.product_key}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[10px]">ID Hubla</Label>
                      <Input value={item.hubla_product_id ?? ""} readOnly className="text-xs bg-muted" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Preço</Label>
                      <Input value={priceLabel(item.price_cents)} readOnly className="text-xs bg-muted" />
                    </div>
                  </div>
                  {item.checkout_url && (
                    <div className="flex gap-2">
                      <Input value={item.checkout_url} readOnly className="text-xs bg-muted" />
                      <Button variant="outline" size="icon" asChild>
                        <a href={item.checkout_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-1">
                    Cursos: {Array.from(hublaCourses[item.id] ?? [])
                      .map((cid) => courses.find((c) => c.id === cid)?.title)
                      .filter(Boolean)
                      .join(", ") || "nenhum"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* DRAFT DIALOG */}
      {draft && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">
              {draftIsNew ? "Novo produto ASAAS" : `Editar ${draft.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Chave do produto</Label>
                <Input
                  value={draft.product_key}
                  onChange={(e) => setDraft({ ...draft, product_key: e.target.value })}
                  placeholder="ex: plano_open"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome exibido</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Plano OPEN"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v: any) => setDraft({ ...draft, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="subscription">Assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ciclo (só assinaturas)</Label>
                <Select
                  value={draft.billing_cycle ?? "null"}
                  onValueChange={(v) => setDraft({ ...draft, billing_cycle: v === "null" ? null : (v as any) })}
                  disabled={draft.type !== "subscription"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">—</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço (centavos)</Label>
                <Input
                  type="number"
                  value={draft.price_cents}
                  onChange={(e) => setDraft({ ...draft, price_cents: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">{priceLabel(draft.price_cents)}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tier do plano</Label>
                <Input
                  value={draft.plan_tier ?? ""}
                  onChange={(e) => setDraft({ ...draft, plan_tier: e.target.value })}
                  placeholder="open, pro, vip..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordem de exibição</Label>
                <Input
                  type="number"
                  value={draft.display_order}
                  onChange={(e) => setDraft({ ...draft, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-center">
                <Label className="text-xs flex items-center gap-2">
                  <Switch
                    checked={draft.active}
                    onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                  />
                  Ativo no checkout
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              <Label className="text-xs sm:col-span-2 font-semibold">Permissões liberadas ao pagar</Label>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-2">
                  <Switch
                    checked={draft.grants_course_access}
                    onCheckedChange={(v) => setDraft({ ...draft, grants_course_access: v })}
                  />
                  Libera acesso aos cursos vinculados
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-2">
                  <Switch
                    checked={draft.grants_ebook1_access}
                    onCheckedChange={(v) => setDraft({ ...draft, grants_ebook1_access: v })}
                  />
                  Ebook 1
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-2">
                  <Switch
                    checked={draft.grants_ebook2_access}
                    onCheckedChange={(v) => setDraft({ ...draft, grants_ebook2_access: v })}
                  />
                  Ebook 2
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-2">
                  <Switch
                    checked={draft.grants_ebook3_access}
                    onCheckedChange={(v) => setDraft({ ...draft, grants_ebook3_access: v })}
                  />
                  Ebook 3
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segundos roteiro (IA Falaê)</Label>
                <Input
                  type="number"
                  value={draft.grants_scripted_seconds}
                  onChange={(e) => setDraft({ ...draft, grants_scripted_seconds: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segundos livre (IA Falaê)</Label>
                <Input
                  type="number"
                  value={draft.grants_unscripted_seconds}
                  onChange={(e) => setDraft({ ...draft, grants_unscripted_seconds: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label className="text-xs font-semibold">Cursos vinculados</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {courses.map((c) => {
                  const checked = productCourses[draft.id]?.has(c.id) ?? false;
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-sm rounded-md border border-border/50 px-2 py-1.5 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleProductCourse(draft.id, c.id, !!v)}
                      />
                      <span className="flex-1">{c.title}</span>
                      <span className="text-[10px] uppercase text-muted-foreground font-mono">
                        {c.level} · {c.required_tier}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button onClick={upsertProduct} disabled={loading}>
                <Save className="h-4 w-4 mr-1.5" />
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
