import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Search, Settings, UserPlus, CalendarClock, AlertTriangle, Target, Copy, Save, CalendarPlus,
  Flame, Dumbbell, CheckCircle2, Clock, ExternalLink, MessageSquarePlus, RefreshCw, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES: Record<string, string> = {
  novo_cliente: "Novo cliente",
  em_uso: "Em uso",
  engajado: "Engajado",
  oportunidade_guia: "Oportunidade Guia",
  oportunidade_treino: "Oportunidade Treino Express",
  oportunidade_pro: "Oportunidade Plano PRO",
  cliente_pro: "Cliente Plano PRO",
  sem_interesse: "Sem interesse agora",
  reativacao_futura: "Reativação futura",
};
const OFFERS: Record<string, string> = { nenhuma: "Nenhuma", outro_guia: "Outro Guia", treino_express: "Treino Express", plano_pro: "Plano PRO" };
const CHANNELS: Record<string, string> = { whatsapp: "WhatsApp", email: "E-mail", ligacao: "Ligação", app: "App" };
const CONTACT_TYPES: Record<string, string> = { automatico: "Automático", humano: "Humano" };
const HISTORY_TYPES: Record<string, string> = {
  compra: "Compra",
  acesso_produto: "Acesso ao produto",
  email_automatico: "E-mail automático",
  email_manual: "E-mail manual",
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  resposta_cliente: "Resposta do cliente",
  pedido_ajuda: "Pediu ajuda",
  interesse: "Demonstrou interesse",
  oferta_enviada: "Oferta enviada",
  venda: "Venda",
  tarefa_criada: "Tarefa criada",
  tarefa_concluida: "Tarefa concluída",
  observacao_interna: "Observação interna",
  mudanca_etapa: "Mudança de etapa",
};
const MANUAL_HISTORY = ["whatsapp", "ligacao", "email_manual", "resposta_cliente", "pedido_ajuda", "interesse", "oferta_enviada", "venda", "acesso_produto", "observacao_interna"];
const CONTACT_HISTORY = ["whatsapp", "ligacao", "email_manual", "oferta_enviada", "venda"];
const PRIORITIES: Record<string, string> = { alta: "Alta", normal: "Normal", baixa: "Baixa" };
const STEPS = [0, 1, 3, 7, 14, 30];
const STEP_TYPE: Record<number, string> = { 0: "automatico", 1: "automatico", 3: "automatico", 7: "humano", 14: "humano", 30: "automatico" };
const DEFAULT_ENGAGEMENT = { medium: 300, high: 1500, recent_events: 5, no_contact_days: 30 };
const NONE = "__none__";
const ALL = "all";

type Purchase = { product_key: string | null; name: string; included: string[]; included_keys: string[]; paid_at: string; value_cents: number };
type Relationship = {
  stage: string;
  responsible_id: string | null;
  preferred_channel: string | null;
  next_offer: string;
  next_offer_notes: string | null;
  next_offer_suggested_at: string | null;
  next_offer_responsible_id: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  next_contact_type: string | null;
  manual_attention: boolean;
  internal_notes: string | null;
};
type Customer = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_activity: string | null;
  xp: number;
  recent_events: number;
  bst_products: number;
  course_access: number;
  categories: string[] | null;
  purchases: Purchase[];
  subscriptions: { product_key: string; name: string; status: string; created_at: string }[];
  last_purchase_at: string | null;
  has_reply: boolean;
  relationship: Partial<Relationship> | null;
};
type Admin = { user_id: string; name: string };
type Task = {
  id: string; user_id: string; task_type: string; source: string; reason: string; responsible_id: string | null;
  due_at: string; priority: string; status: string; completed_at: string | null; notes: string | null;
};
type Template = {
  id: string; name: string; day_offset: number; interaction_type: string; product_key: string | null;
  stage: string | null; next_offer: string | null; message: string; active: boolean;
};
type HistoryRow = { id: string; type: string; channel: string | null; responsible_id: string | null; notes: string | null; result: string | null; created_at: string };
type Engagement = typeof DEFAULT_ENGAGEMENT;

const emptyRel: Relationship = {
  stage: "novo_cliente", responsible_id: null, preferred_channel: null, next_offer: "nenhuma", next_offer_notes: null,
  next_offer_suggested_at: null, next_offer_responsible_id: null, last_contact_at: null, next_contact_at: null,
  next_contact_type: null, manual_attention: false, internal_notes: null,
};
const relOf = (c: Customer): Relationship => ({ ...emptyRel, ...(c.relationship ?? {}) } as Relationship);

/** Nome comercial: remove o prefixo técnico "BST". */
const commercial = (name?: string | null) => (name ?? "").replace(/^BST\s+/i, "").trim() || "Produto";
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const daysSince = (v?: string | null) => (v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null);
const toLocalInput = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const dayBounds = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

function dueStatus(v?: string | null): "overdue" | "today" | "future" | "none" {
  if (!v) return "none";
  const d = new Date(v);
  const { start, end } = dayBounds();
  if (d < start) return "overdue";
  if (d < end) return "today";
  return "future";
}

function taskStatus(t: Task): { key: string; label: string } {
  if (t.status === "concluida") return { key: "concluida", label: "Concluída" };
  if (t.status === "cancelada") return { key: "cancelada", label: "Cancelada" };
  const due = dueStatus(t.due_at);
  if (due === "overdue") return { key: "atrasada", label: "Atrasada" };
  if (due === "today") return { key: "hoje", label: "Hoje" };
  if (t.status === "adiada") return { key: "adiada", label: "Adiada" };
  return { key: "pendente", label: "Pendente" };
}
const isOpen = (t: Task) => t.status === "pendente" || t.status === "adiada";

function cadence(lastPurchase?: string | null) {
  const days = daysSince(lastPurchase);
  if (days === null) return { days: null as number | null, current: null as number | null, next: null as number | null };
  const current = [...STEPS].reverse().find((s) => s <= days) ?? 0;
  const next = STEPS.find((s) => s > days) ?? null;
  return { days, current, next };
}

function engagementOf(c: Customer, e: Engagement): "Alto" | "Médio" | "Baixo" {
  if (c.xp >= e.high || c.recent_events >= e.recent_events) return "Alto";
  if (c.xp >= e.medium || c.recent_events > 0 || c.has_reply) return "Médio";
  return "Baixo";
}

function productNames(c: Customer) {
  const names = new Set<string>();
  c.purchases.forEach((p) => names.add(commercial(p.name)));
  c.subscriptions.forEach((s) => names.add(commercial(s.name)));
  return [...names];
}
function productKeys(c: Customer) {
  return [
    ...c.purchases.flatMap((p) => [p.product_key, ...(p.included_keys ?? [])]),
    ...c.subscriptions.map((s) => s.product_key),
  ].filter(Boolean) as string[];
}

function pickTemplate(templates: Template[], c: Customer, rel: Relationship, day: number) {
  const keys = productKeys(c);
  const candidates = templates.filter((t) => t.active && t.day_offset === day);
  const score = (t: Template) =>
    (t.product_key && keys.includes(t.product_key) ? 4 : t.product_key ? -100 : 0) +
    (t.stage && t.stage === rel.stage ? 2 : t.stage ? -100 : 0) +
    (t.next_offer && t.next_offer === rel.next_offer ? 1 : t.next_offer ? -100 : 0);
  return candidates.filter((t) => score(t) >= 0).sort((a, b) => score(b) - score(a))[0] ?? null;
}

export default function RelationshipManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [engagement, setEngagement] = useState<Engagement>(DEFAULT_ENGAGEMENT);
  const [defaultResp, setDefaultResp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("tarefas");
  const [query, setQuery] = useState("");
  const [stageF, setStageF] = useState(ALL);
  const [productF, setProductF] = useState(ALL);
  const [respF, setRespF] = useState(ALL);
  const [dueF, setDueF] = useState(ALL);
  const [quickF, setQuickF] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => {
    const [{ data, error }, { data: settings }, { data: taskRows }, { data: tplRows }] = await Promise.all([
      (supabase as any).rpc("get_relationship_customers"),
      supabase.from("relationship_settings").select("key, value").in("key", ["engagement", "default_responsible"]),
      supabase.from("relationship_tasks").select("*").order("due_at"),
      supabase.from("relationship_message_templates").select("*").order("day_offset"),
    ]);
    if (error) toast.error("Não foi possível carregar os clientes.");
    const payload = (data ?? {}) as { customers?: Customer[]; admins?: Admin[] };
    setCustomers((payload.customers ?? []).sort((a, b) => (b.last_purchase_at ?? "").localeCompare(a.last_purchase_at ?? "")));
    setAdmins(payload.admins ?? []);
    setTasks((taskRows as Task[]) ?? []);
    setTemplates((tplRows as Template[]) ?? []);
    (settings ?? []).forEach((s: any) => {
      if (s.key === "engagement") setEngagement({ ...DEFAULT_ENGAGEMENT, ...(s.value as any) });
      if (s.key === "default_responsible") setDefaultResp((s.value as any)?.user_id ?? null);
    });
    setLoading(false);
    window.dispatchEvent(new Event("relationship:changed"));
  };

  useEffect(() => {
    load();
  }, []);

  const adminName = (id?: string | null) => admins.find((a) => a.user_id === id)?.name ?? "—";
  const byId = useMemo(() => new Map(customers.map((c) => [c.user_id, c])), [customers]);
  const openTasksByUser = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.filter(isOpen).forEach((t) => m.set(t.user_id, [...(m.get(t.user_id) ?? []), t]));
    return m;
  }, [tasks]);

  const userTaskStatus = (userId: string) => {
    const open = openTasksByUser.get(userId) ?? [];
    if (open.length === 0) return null;
    const order = ["atrasada", "hoje", "adiada", "pendente"];
    return open.map(taskStatus).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))[0];
  };

  const signals = (c: Customer) => {
    const out: string[] = [];
    const rel = relOf(c);
    const guides = new Set<string>();
    c.purchases.forEach((p) => {
      if (p.product_key?.startsWith("bst")) guides.add(p.product_key);
      p.included_keys?.forEach((k) => k?.startsWith("bst") && guides.add(k));
    });
    const days = daysSince(c.last_purchase_at);
    if (c.has_reply) out.push("Cliente respondeu");
    if (guides.size > 1) out.push("Mais de um Guia");
    if (c.xp >= engagement.high) out.push("XP alto");
    if (c.recent_events >= engagement.recent_events) out.push("Uso recente alto");
    if (rel.manual_attention) out.push("Atenção manual");
    if (days !== null && days >= 7 && days < 14) out.push("D+7");
    if (days !== null && days >= 14 && days < 30) out.push("D+14");
    if (dueStatus(rel.next_contact_at) === "overdue") out.push("Contato vencido");
    return out;
  };

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      c.purchases.forEach((p) => {
        if (p.product_key) map.set(p.product_key, commercial(p.name));
      });
      c.subscriptions.forEach((s) => s.product_key && map.set(s.product_key, commercial(s.name)));
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const rel = relOf(c);
      if (q && !(c.name ?? "").toLowerCase().includes(q) && !(c.email ?? "").toLowerCase().includes(q)) return false;
      if (stageF !== ALL && rel.stage !== stageF) return false;
      if (respF === NONE && rel.responsible_id) return false;
      if (respF !== ALL && respF !== NONE && rel.responsible_id !== respF) return false;
      if (dueF !== ALL && dueStatus(rel.next_contact_at) !== dueF) return false;
      if (productF !== ALL && !productKeys(c).includes(productF)) return false;
      const ts = userTaskStatus(c.user_id)?.key;
      if (quickF === "tarefas_hoje" && ts !== "hoje") return false;
      if (quickF === "tarefas_atrasadas" && ts !== "atrasada") return false;
      if (quickF === "op_treino" && rel.stage !== "oportunidade_treino" && rel.next_offer !== "treino_express") return false;
      if (quickF === "op_pro" && rel.stage !== "oportunidade_pro" && rel.next_offer !== "plano_pro") return false;
      if (quickF === "alto" && engagementOf(c, engagement) !== "Alto") return false;
      if (quickF === "sem_contato") {
        const d = daysSince(rel.last_contact_at);
        if (d !== null && d < engagement.no_contact_days) return false;
      }
      return true;
    });
  }, [customers, query, stageF, respF, dueF, productF, quickF, openTasksByUser, engagement]);

  const summary = useMemo(() => {
    let novos = 0, engajados = 0, treino = 0, pro = 0;
    customers.forEach((c) => {
      const rel = relOf(c);
      if (rel.stage === "novo_cliente") novos++;
      if (engagementOf(c, engagement) === "Alto") engajados++;
      if (rel.stage === "oportunidade_treino" || rel.next_offer === "treino_express") treino++;
      if (rel.stage === "oportunidade_pro" || rel.next_offer === "plano_pro") pro++;
    });
    const open = tasks.filter(isOpen).map(taskStatus);
    return {
      novos, engajados, treino, pro,
      hoje: open.filter((s) => s.key === "hoje").length,
      atrasadas: open.filter((s) => s.key === "atrasada").length,
    };
  }, [customers, tasks, engagement]);

  const todayTasks = useMemo(() => {
    const rank: Record<string, number> = { alta: 0, normal: 1, baixa: 2 };
    return tasks
      .filter((t) => isOpen(t) && ["hoje", "atrasada"].includes(taskStatus(t).key))
      .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || a.due_at.localeCompare(b.due_at));
  }, [tasks]);
  const upcomingTasks = useMemo(() => tasks.filter((t) => isOpen(t) && dueStatus(t.due_at) === "future"), [tasks]);

  const applyQuick = (q: string) => {
    setQuickF(q);
    setTab("clientes");
  };

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Relacionamento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quem precisa de contato, por quê e qual o próximo passo. Nenhuma mensagem é enviada ao cliente automaticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4 mr-1.5" /> Configurações
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard icon={CalendarClock} label="Tarefas hoje" value={summary.hoje} onClick={() => setTab("tarefas")} />
        <SummaryCard icon={AlertTriangle} label="Tarefas atrasadas" value={summary.atrasadas} tone="destructive" onClick={() => setTab("tarefas")} />
        <SummaryCard icon={UserPlus} label="Novos clientes" value={summary.novos} onClick={() => { setStageF("novo_cliente"); setTab("clientes"); }} />
        <SummaryCard icon={Flame} label="Clientes engajados" value={summary.engajados} onClick={() => applyQuick("alto")} />
        <SummaryCard icon={Dumbbell} label="Oport. Treino Express" value={summary.treino} onClick={() => applyQuick("op_treino")} />
        <SummaryCard icon={Target} label="Oport. Plano PRO" value={summary.pro} onClick={() => applyQuick("op_pro")} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="tarefas">
              Tarefas de hoje
              {todayTasks.length > 0 && <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">{todayTasks.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="clientes">Clientes ({customers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="space-y-3 mt-4">
            {todayTasks.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa para hoje. 🎉</CardContent></Card>
            ) : (
              todayTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  customer={byId.get(t.user_id)}
                  admins={admins}
                  engagementLabel={(c) => engagementOf(c, engagement)}
                  onOpen={() => setSelectedId(t.user_id)}
                  onChanged={load}
                />
              ))
            )}
            {upcomingTasks.length > 0 && (
              <p className="text-xs text-muted-foreground">{upcomingTasks.length} tarefa(s) agendada(s) para os próximos dias.</p>
            )}
          </TabsContent>

          <TabsContent value="clientes" className="space-y-3 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
              </div>
              <FilterSelect label="Atalho" value={quickF} onChange={setQuickF} options={[
                ["tarefas_hoje", "Tarefas de hoje"], ["tarefas_atrasadas", "Tarefas atrasadas"],
                ["op_treino", "Oportunidade Treino Express"], ["op_pro", "Oportunidade Plano PRO"],
                ["alto", "Alto engajamento"], ["sem_contato", "Sem contato recente"],
              ]} />
              <FilterSelect label="Etapa" value={stageF} onChange={setStageF} options={Object.entries(STAGES)} />
              <FilterSelect label="Produto" value={productF} onChange={setProductF} options={productOptions} />
              <FilterSelect label="Responsável" value={respF} onChange={setRespF}
                options={[[NONE, "Sem responsável"], ...admins.map((a) => [a.user_id, a.name] as [string, string])]} />
              <FilterSelect label="Próximo contato" value={dueF} onChange={setDueF}
                options={[["overdue", "Vencido"], ["today", "Hoje"], ["future", "Futuro"], ["none", "Sem data"]]} />
              {(stageF !== ALL || productF !== ALL || respF !== ALL || dueF !== ALL || quickF !== ALL || query) && (
                <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setStageF(ALL); setProductF(ALL); setRespF(ALL); setDueF(ALL); setQuickF(ALL); }}>
                  Limpar filtros
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead>Última compra</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Último contato</TableHead>
                      <TableHead>Próximo contato</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>XP</TableHead>
                      <TableHead>Engajamento</TableHead>
                      <TableHead>Próxima oferta</TableHead>
                      <TableHead>Tarefa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
                    )}
                    {filtered.map((c) => {
                      const rel = relOf(c);
                      const due = dueStatus(rel.next_contact_at);
                      const sig = signals(c);
                      const ts = userTaskStatus(c.user_id);
                      const cad = cadence(c.last_purchase_at);
                      const type = rel.next_contact_type ?? (cad.next !== null ? STEP_TYPE[cad.next] : null);
                      return (
                        <TableRow key={c.user_id} className="cursor-pointer" onClick={() => setSelectedId(c.user_id)}>
                          <TableCell className="min-w-[200px]">
                            <div className="font-medium text-foreground">{c.name || "(sem nome)"}</div>
                            <div className="text-xs text-muted-foreground">{c.email}</div>
                            {sig.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {sig.map((s) => <Badge key={s} variant={s === "Contato vencido" ? "destructive" : "secondary"} className="text-[10px]">{s}</Badge>)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[220px] text-xs">{productNames(c).join(", ") || "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(c.last_purchase_at)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] whitespace-nowrap">{STAGES[rel.stage]}</Badge></TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(rel.last_contact_at)}</TableCell>
                          <TableCell className={cn("text-xs whitespace-nowrap", due === "overdue" && "text-destructive font-medium", due === "today" && "text-primary font-medium")}>
                            {fmtDate(rel.next_contact_at)}
                          </TableCell>
                          <TableCell className="text-xs">{type ? CONTACT_TYPES[type] : "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{adminName(rel.responsible_id)}</TableCell>
                          <TableCell className="text-xs font-semibold tabular-nums">{c.xp.toLocaleString("pt-BR")}</TableCell>
                          <TableCell><EngagementBadge level={engagementOf(c, engagement)} /></TableCell>
                          <TableCell className="text-xs">{OFFERS[rel.next_offer]}</TableCell>
                          <TableCell>{ts ? <TaskStatusBadge status={ts} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">{filtered.length} de {customers.length} cliente(s)</p>
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <CustomerSheet
              key={selected.user_id}
              customer={selected}
              admins={admins}
              templates={templates}
              tasks={tasks.filter((t) => t.user_id === selected.user_id)}
              defaultResp={defaultResp}
              engagementLevel={engagementOf(selected, engagement)}
              signals={signals(selected)}
              onSaved={load}
            />
          )}
        </SheetContent>
      </Sheet>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        engagement={engagement}
        defaultResp={defaultResp}
        admins={admins}
        templates={templates}
        onSaved={load}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, onClick }: { icon: any; label: string; value: number; tone?: "destructive"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="p-4 h-full hover:border-primary/60 transition-colors">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={cn("h-4 w-4 shrink-0", tone === "destructive" ? "text-destructive" : "text-primary")} /> {label}
        </div>
        <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "destructive" && value > 0 ? "text-destructive" : "text-foreground")}>{value}</p>
      </Card>
    </button>
  );
}

function EngagementBadge({ level }: { level: string }) {
  return (
    <Badge variant={level === "Alto" ? "default" : level === "Médio" ? "secondary" : "outline"} className="text-[10px] whitespace-nowrap">
      {level}
    </Badge>
  );
}

function TaskStatusBadge({ status }: { status: { key: string; label: string } }) {
  return (
    <Badge
      variant={status.key === "atrasada" ? "destructive" : status.key === "hoje" ? "default" : status.key === "concluida" ? "secondary" : "outline"}
      className="text-[10px] whitespace-nowrap"
    >
      {status.label}
    </Badge>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[190px]" aria-label={`Filtrar por ${label}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

async function completeTask(task: Task, note?: string) {
  const { error } = await supabase
    .from("relationship_tasks")
    .update({ status: "concluida", completed_at: new Date().toISOString(), notes: note ?? task.notes, updated_at: new Date().toISOString() })
    .eq("id", task.id);
  if (error) throw error;
  const { data: me } = await supabase.auth.getUser();
  await supabase.from("customer_relationship_history").insert({
    user_id: task.user_id, type: "tarefa_concluida", responsible_id: task.responsible_id,
    notes: task.reason, result: note ?? null, created_by: me.user?.id ?? null,
  });
}

function TaskCard({
  task, customer: c, admins, engagementLabel, onOpen, onChanged,
}: {
  task: Task; customer?: Customer; admins: Admin[]; engagementLabel: (c: Customer) => string; onOpen: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const status = taskStatus(task);
  const rel = c ? relOf(c) : emptyRel;
  const days = daysSince(c?.last_purchase_at);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch {
      toast.error("Não foi possível atualizar a tarefa.");
    }
    setBusy(false);
  };

  const postpone = () =>
    run(async () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      const { error } = await supabase.from("relationship_tasks").update({ status: "adiada", due_at: d.toISOString(), updated_at: new Date().toISOString() }).eq("id", task.id);
      if (error) throw error;
    }, "Tarefa adiada para amanhã.");

  const reassign = (v: string) =>
    run(async () => {
      const { error } = await supabase.from("relationship_tasks").update({ responsible_id: v === NONE ? null : v, updated_at: new Date().toISOString() }).eq("id", task.id);
      if (error) throw error;
    }, "Responsável atualizado.");

  return (
    <Card className={cn(status.key === "atrasada" && "border-destructive/50")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{c?.name || "(cliente)"}</span>
              <Badge variant={task.priority === "alta" ? "destructive" : task.priority === "normal" ? "secondary" : "outline"} className="text-[10px]">
                Prioridade {PRIORITIES[task.priority]}
              </Badge>
              <TaskStatusBadge status={status} />
            </div>
            <p className="text-sm text-foreground mt-1"><strong>Motivo:</strong> {task.reason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {c ? productNames(c).join(", ") : "—"} · {days !== null ? `${days} dia(s) desde a compra` : "sem data de compra"}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Prazo: {fmtDateTime(task.due_at)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="outline">{STAGES[rel.stage]}</Badge>
          <Badge variant="outline">{c?.xp.toLocaleString("pt-BR") ?? 0} XP · {c ? engagementLabel(c) : "—"}</Badge>
          <Badge variant="outline">{c?.recent_events ?? 0} acesso(s) em 7 dias</Badge>
          <Badge variant="outline">Oferta: {OFFERS[rel.next_offer]}</Badge>
          {rel.preferred_channel && <Badge variant="outline">Contato sugerido: {CHANNELS[rel.preferred_channel]}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onOpen}><ExternalLink className="h-4 w-4 mr-1.5" /> Abrir cliente</Button>
          <Button size="sm" variant="outline" onClick={onOpen}><MessageSquarePlus className="h-4 w-4 mr-1.5" /> Registrar contato</Button>
          <Button size="sm" disabled={busy} onClick={() => run(() => completeTask(task), "Tarefa concluída.")}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Concluir
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={postpone}><Clock className="h-4 w-4 mr-1.5" /> Adiar</Button>
          <Select value={task.responsible_id ?? NONE} onValueChange={reassign} disabled={busy}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Reatribuir tarefa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem responsável</SelectItem>
              {admins.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerSheet({
  customer: c, admins, templates, tasks, defaultResp, engagementLevel, signals, onSaved,
}: {
  customer: Customer; admins: Admin[]; templates: Template[]; tasks: Task[]; defaultResp: string | null;
  engagementLevel: string; signals: string[]; onSaved: () => void;
}) {
  const [rel, setRel] = useState<Relationship>(relOf(c));
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const openTasks = tasks.filter(isOpen);
  const [contact, setContact] = useState({
    type: "whatsapp", channel: rel.preferred_channel ?? "whatsapp", notes: "", result: "",
    responsible_id: rel.responsible_id ?? defaultResp ?? NONE, completeTaskId: openTasks[0]?.id ?? NONE,
  });
  const [registering, setRegistering] = useState(false);
  const cad = cadence(c.last_purchase_at);
  const step = cad.current ?? 0;
  const firstName = (c.name || "").split(" ")[0] || "aluno";
  const tpl = pickTemplate(templates, c, rel, step);
  const suggested = (tpl?.message ?? "").split("[nome]").join(firstName);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("customer_relationship_history")
      .select("id, type, channel, responsible_id, notes, result, created_at")
      .eq("user_id", c.user_id)
      .order("created_at", { ascending: false });
    setHistory((data as HistoryRow[]) ?? []);
  };
  useEffect(() => {
    loadHistory();
  }, [c.user_id]);

  const timeline = useMemo(() => {
    const purchases = c.purchases.map((p, i) => ({
      id: `p${i}`, type: "compra", channel: null, responsible_id: null, result: null,
      notes: `Comprou ${commercial(p.name)}${p.included?.length ? ` (${p.included.map(commercial).join(", ")})` : ""}`,
      created_at: p.paid_at,
    }));
    return [...history, ...purchases].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [history, c.purchases]);

  const persist = async (patch: Partial<Relationship>) => {
    const { error } = await supabase.from("customer_relationships").upsert({ user_id: c.user_id, ...rel, ...patch } as any, { onConflict: "user_id" });
    if (error) throw error;
  };

  const save = async () => {
    setSaving(true);
    try {
      await persist({});
      toast.success("Ficha atualizada.");
      await loadHistory();
      onSaved();
    } catch {
      toast.error("Não foi possível salvar a ficha.");
    }
    setSaving(false);
  };

  const scheduleFromCadence = () => {
    if (cad.next === null || !c.last_purchase_at) return;
    const d = new Date(c.last_purchase_at);
    d.setDate(d.getDate() + cad.next);
    d.setHours(10, 0, 0, 0);
    setRel({ ...rel, next_contact_at: d.toISOString(), next_contact_type: STEP_TYPE[cad.next] });
    toast.info(`Próximo contato D+${cad.next} definido. Clique em Salvar ficha.`);
  };

  const createHumanTask = async () => {
    const due = rel.next_contact_at ?? new Date().toISOString();
    const { error } = await supabase.from("relationship_tasks").insert({
      user_id: c.user_id, task_type: "manual", source: "manual", reason: "Contato humano agendado por ADMIN",
      responsible_id: rel.responsible_id ?? defaultResp, due_at: due, priority: "normal",
    });
    if (error) { toast.error("Não foi possível criar a tarefa."); return; }
    const { data: me } = await supabase.auth.getUser();
    await supabase.from("customer_relationship_history").insert({
      user_id: c.user_id, type: "tarefa_criada", responsible_id: rel.responsible_id ?? defaultResp,
      notes: `Tarefa manual para ${fmtDate(due)}`, created_by: me.user?.id ?? null,
    });
    toast.success("Tarefa criada.");
    loadHistory();
    onSaved();
  };

  const register = async () => {
    if (!contact.notes.trim()) { toast.error("Escreva uma observação para registrar o contato."); return; }
    setRegistering(true);
    const { data: me } = await supabase.auth.getUser();
    const responsible = contact.responsible_id === NONE ? null : contact.responsible_id;
    const { error } = await supabase.from("customer_relationship_history").insert({
      user_id: c.user_id, type: contact.type, channel: contact.channel, responsible_id: responsible,
      notes: contact.notes.trim(), result: contact.result.trim() || null, created_by: me.user?.id ?? null,
    });
    if (!error) {
      if (CONTACT_HISTORY.includes(contact.type)) {
        const now = new Date().toISOString();
        try {
          await persist({ last_contact_at: now });
          setRel((r) => ({ ...r, last_contact_at: now }));
        } catch { /* histórico já salvo */ }
      }
      const task = openTasks.find((t) => t.id === contact.completeTaskId);
      if (task) {
        try { await completeTask(task, contact.result.trim() || contact.notes.trim()); } catch { /* ignore */ }
      }
    }
    setRegistering(false);
    if (error) { toast.error("Não foi possível registrar o contato."); return; }
    toast.success(contact.completeTaskId !== NONE ? "Contato registrado e tarefa concluída." : "Contato registrado.");
    setContact({ ...contact, notes: "", result: "", completeTaskId: NONE });
    loadHistory();
    onSaved();
  };

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle>{c.name || "(sem nome)"}</SheetTitle>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline">{c.email}</Badge>
          {c.phone && <Badge variant="outline">{c.phone}</Badge>}
          {signals.map((s) => <Badge key={s} variant={s === "Contato vencido" ? "destructive" : "secondary"}>{s}</Badge>)}
        </div>
      </SheetHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Info label="XP" value={c.xp.toLocaleString("pt-BR")} helper={`${engagementLevel} engajamento`} />
        <Info label="Último acesso" value={fmtDate(c.last_activity)} />
        <Info label="Acessos 7 dias" value={String(c.recent_events)} helper="atividades com XP" />
        <Info label="Produtos BST" value={String(c.bst_products)} helper={`${c.course_access} curso(s)`} />
      </div>

      {openTasks.length > 0 && (
        <Section title="Tarefas abertas">
          <div className="space-y-2">
            {openTasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{t.reason} <span className="text-xs text-muted-foreground">· {PRIORITIES[t.priority]} · {fmtDate(t.due_at)} · {admins.find((a) => a.user_id === t.responsible_id)?.name ?? "sem responsável"}</span></span>
                <TaskStatusBadge status={taskStatus(t)} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Produtos e compras">
        <div className="space-y-1.5">
          {c.purchases.map((p, i) => (
            <div key={i} className="flex justify-between gap-3 text-sm">
              <span>
                {commercial(p.name)}
                {p.included?.length > 0 && <span className="text-xs text-muted-foreground"> — {p.included.map(commercial).join(", ")}</span>}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.paid_at)}</span>
            </div>
          ))}
          {c.subscriptions.map((s, i) => (
            <div key={`s${i}`} className="flex justify-between gap-3 text-sm">
              <span>{commercial(s.name)} <Badge variant="outline" className="text-[10px] ml-1">{s.status}</Badge></span>
              <span className="text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
            </div>
          ))}
          {(c.categories ?? []).length > 0 && (
            <p className="text-xs text-muted-foreground">Acessos no app: {(c.categories ?? []).join(", ").toUpperCase()}</p>
          )}
        </div>
      </Section>

      <Section title="Régua de relacionamento">
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s) => {
            const done = cad.days !== null && cad.days >= s;
            const isCurrent = cad.current === s;
            return (
              <span key={s} className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                isCurrent ? "bg-primary text-primary-foreground border-primary" : done ? "bg-muted text-muted-foreground" : "text-foreground",
              )}>
                {s === 0 ? "D0" : `D+${s}`} · {STEP_TYPE[s] === "humano" ? "Humano" : "Auto"}
              </span>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {cad.days === null ? "Sem data de compra." : `Compra há ${cad.days} dia(s). ${cad.next !== null ? `Próximo marco: D+${cad.next} (${CONTACT_TYPES[STEP_TYPE[cad.next]]}).` : "Régua concluída."}`}
          {" "}Etapas automáticas ainda não enviam e-mails — aguardam sua confirmação.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {cad.next !== null && (
            <Button size="sm" variant="outline" onClick={scheduleFromCadence}><CalendarPlus className="h-4 w-4 mr-1.5" /> Agendar D+{cad.next}</Button>
          )}
          <Button size="sm" variant="outline" onClick={createHumanTask}><MessageSquarePlus className="h-4 w-4 mr-1.5" /> Criar tarefa humana</Button>
        </div>
      </Section>

      <Section title={`Mensagem sugerida (${step === 0 ? "D0" : `D+${step}`}${tpl ? ` · ${CONTACT_TYPES[tpl.interaction_type]}` : ""})`}>
        {suggested ? (
          <>
            <p className="text-sm text-foreground whitespace-pre-line">{suggested}</p>
            <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => { navigator.clipboard.writeText(suggested); toast.success("Mensagem copiada."); }}>
              <Copy className="h-4 w-4 mr-1.5" /> Copiar
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum modelo ativo para esta etapa.</p>
        )}
      </Section>

      <Section title="Acompanhamento">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Etapa">
            <SimpleSelect value={rel.stage} onChange={(v) => setRel({ ...rel, stage: v })} options={Object.entries(STAGES)} />
          </Field>
          <Field label="Responsável">
            <SimpleSelect value={rel.responsible_id ?? NONE} onChange={(v) => setRel({ ...rel, responsible_id: v === NONE ? null : v })}
              options={[[NONE, "Sem responsável"], ...admins.map((a) => [a.user_id, a.name] as [string, string])]} />
          </Field>
          <Field label="Canal preferido">
            <SimpleSelect value={rel.preferred_channel ?? NONE} onChange={(v) => setRel({ ...rel, preferred_channel: v === NONE ? null : v })}
              options={[[NONE, "Não definido"], ...Object.entries(CHANNELS)]} />
          </Field>
          <Field label="Próximo contato">
            <Input type="datetime-local" value={toLocalInput(rel.next_contact_at)}
              onChange={(e) => setRel({ ...rel, next_contact_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </Field>
          <Field label="Tipo do próximo contato">
            <SimpleSelect value={rel.next_contact_type ?? NONE} onChange={(v) => setRel({ ...rel, next_contact_type: v === NONE ? null : v })}
              options={[[NONE, "Pela régua"], ...Object.entries(CONTACT_TYPES)]} />
          </Field>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label className="text-xs">Marcar para atenção humana</Label>
            <Switch checked={rel.manual_attention} onCheckedChange={(v) => setRel({ ...rel, manual_attention: v })} />
          </div>
          <Field label="Próxima oferta">
            <SimpleSelect value={rel.next_offer} onChange={(v) => setRel({ ...rel, next_offer: v })} options={Object.entries(OFFERS)} />
          </Field>
          <Field label="Data sugerida da oferta">
            <Input type="date" value={rel.next_offer_suggested_at ? rel.next_offer_suggested_at.slice(0, 10) : ""}
              onChange={(e) => setRel({ ...rel, next_offer_suggested_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
          </Field>
          <Field label="Motivo da oferta">
            <Input value={rel.next_offer_notes ?? ""} onChange={(e) => setRel({ ...rel, next_offer_notes: e.target.value })} placeholder="Ex: pediu mais prática de conversação" />
          </Field>
          <Field label="Responsável pela oferta">
            <SimpleSelect value={rel.next_offer_responsible_id ?? NONE} onChange={(v) => setRel({ ...rel, next_offer_responsible_id: v === NONE ? null : v })}
              options={[[NONE, "Mesmo do cliente"], ...admins.map((a) => [a.user_id, a.name] as [string, string])]} />
          </Field>
        </div>
        <Field label="Notas internas (somente ADMIN)" className="mt-3">
          <Textarea rows={3} value={rel.internal_notes ?? ""} onChange={(e) => setRel({ ...rel, internal_notes: e.target.value })} />
        </Field>
        <p className="text-xs text-muted-foreground mt-2">Último contato: {fmtDateTime(rel.last_contact_at)}</p>
        <Button className="mt-3" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Salvar ficha
        </Button>
      </Section>

      <Section title="Registrar contato">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo">
            <SimpleSelect value={contact.type} onChange={(v) => setContact({ ...contact, type: v })}
              options={MANUAL_HISTORY.map((k) => [k, HISTORY_TYPES[k]] as [string, string])} />
          </Field>
          <Field label="Canal">
            <SimpleSelect value={contact.channel} onChange={(v) => setContact({ ...contact, channel: v })} options={Object.entries(CHANNELS)} />
          </Field>
          <Field label="Responsável">
            <SimpleSelect value={contact.responsible_id} onChange={(v) => setContact({ ...contact, responsible_id: v })}
              options={[[NONE, "Sem responsável"], ...admins.map((a) => [a.user_id, a.name] as [string, string])]} />
          </Field>
        </div>
        <Textarea className="mt-3" rows={2} placeholder="Observação" value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />
        <Input className="mt-2" placeholder="Resultado (ex: interessado no Plano PRO)" value={contact.result} onChange={(e) => setContact({ ...contact, result: e.target.value })} />
        {openTasks.length > 0 && (
          <div className="mt-2">
            <SimpleSelect value={contact.completeTaskId} onChange={(v) => setContact({ ...contact, completeTaskId: v })}
              options={[[NONE, "Não concluir tarefa"], ...openTasks.map((t) => [t.id, `Concluir: ${t.reason}`] as [string, string])]} />
          </div>
        )}
        <Button className="mt-3" variant="secondary" onClick={register} disabled={registering}>
          {registering && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Registrar
        </Button>
      </Section>

      <Section title="Histórico">
        {timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-3">
            {timeline.map((h) => (
              <li key={h.id} className="ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground">
                  {fmtDateTime(h.created_at)} · {HISTORY_TYPES[h.type] ?? h.type}
                  {h.channel ? ` · ${CHANNELS[h.channel] ?? h.channel}` : ""}
                  {h.responsible_id ? ` · ${admins.find((a) => a.user_id === h.responsible_id)?.name ?? ""}` : ""}
                </div>
                {h.notes && <p className="text-sm text-foreground">{h.type === "mudanca_etapa" ? h.notes.split(" → ").map((s) => STAGES[s] ?? s).join(" → ") : h.notes}</p>}
                {h.result && <p className="text-xs text-primary">Resultado: {h.result}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function SimpleSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Info({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 text-base font-bold tabular-nums text-foreground">{value}</p>
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

function SettingsDialog({
  open, onOpenChange, engagement, defaultResp, admins, templates, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; engagement: Engagement; defaultResp: string | null;
  admins: Admin[]; templates: Template[]; onSaved: () => void;
}) {
  const [e, setE] = useState(engagement);
  const [resp, setResp] = useState(defaultResp ?? NONE);
  const [tpls, setTpls] = useState<Template[]>(templates);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setE(engagement); setResp(defaultResp ?? NONE); setTpls(templates); }
  }, [open]);

  const save = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("relationship_settings").upsert([
      { key: "engagement", value: e as any, updated_at: now },
      { key: "default_responsible", value: { user_id: resp === NONE ? null : resp } as any, updated_at: now },
    ]);
    let tplError = null;
    for (const t of tpls) {
      const orig = templates.find((o) => o.id === t.id);
      if (orig && (orig.message !== t.message || orig.active !== t.active || orig.interaction_type !== t.interaction_type)) {
        const r = await supabase.from("relationship_message_templates")
          .update({ message: t.message, active: t.active, interaction_type: t.interaction_type, updated_at: now }).eq("id", t.id);
        tplError = tplError ?? r.error;
      }
    }
    setSaving(false);
    if (error || tplError) { toast.error("Não foi possível salvar."); return; }
    toast.success("Configurações salvas.");
    onSaved();
    onOpenChange(false);
  };

  const generate = async () => {
    setRunning("gen");
    const { data, error } = await (supabase as any).rpc("generate_relationship_tasks");
    setRunning(null);
    if (error) { toast.error("Não foi possível gerar tarefas."); return; }
    toast.success(`${data ?? 0} nova(s) tarefa(s) criada(s).`);
    onSaved();
  };

  const sendSummary = async () => {
    setRunning("mail");
    const { data, error } = await supabase.functions.invoke("relationship-daily-summary", { body: {} });
    setRunning(null);
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.reason === "no_default_responsible" ? "Defina a responsável padrão primeiro." : "Não foi possível enviar o resumo.");
      return;
    }
    toast.success(`Resumo enviado para ${(data as any).recipient}.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configurações de Relacionamento</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <Section title="Responsável padrão e resumo diário">
            <Field label="Responsável padrão das tarefas humanas (recebe o resumo às 08:00)">
              <SimpleSelect value={resp} onChange={setResp} options={[[NONE, "Nenhum"], ...admins.map((a) => [a.user_id, a.name] as [string, string])]} />
            </Field>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={generate} disabled={!!running}>
                {running === "gen" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />} Gerar tarefas agora
              </Button>
              <Button size="sm" variant="outline" onClick={sendSummary} disabled={!!running}>
                {running === "mail" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />} Enviar resumo agora
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tarefas são geradas todo dia às 07:50 e o resumo é enviado às 08:00 (horário de Brasília).</p>
          </Section>

          <Section title="Faixas de engajamento">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="XP médio a partir de"><Input type="number" value={e.medium} onChange={(ev) => setE({ ...e, medium: Number(ev.target.value) })} /></Field>
              <Field label="XP alto a partir de"><Input type="number" value={e.high} onChange={(ev) => setE({ ...e, high: Number(ev.target.value) })} /></Field>
              <Field label="Atividades em 7 dias (uso alto)"><Input type="number" value={e.recent_events} onChange={(ev) => setE({ ...e, recent_events: Number(ev.target.value) })} /></Field>
              <Field label="Sem contato recente após (dias)"><Input type="number" value={e.no_contact_days} onChange={(ev) => setE({ ...e, no_contact_days: Number(ev.target.value) })} /></Field>
            </div>
          </Section>

          <Section title="Mensagens sugeridas">
            <div className="space-y-4">
              {tpls.map((t, i) => (
                <div key={t.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs">{t.name}</Label>
                    <div className="flex items-center gap-2">
                      <Select value={t.interaction_type} onValueChange={(v) => setTpls(tpls.map((x, j) => (j === i ? { ...x, interaction_type: v } : x)))}>
                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(CONTACT_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                      <Switch checked={t.active} onCheckedChange={(v) => setTpls(tpls.map((x, j) => (j === i ? { ...x, active: v } : x)))} />
                    </div>
                  </div>
                  <Textarea rows={2} value={t.message} onChange={(ev) => setTpls(tpls.map((x, j) => (j === i ? { ...x, message: ev.target.value } : x)))} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Use [nome] para inserir o primeiro nome do cliente.</p>
            </div>
          </Section>

          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
