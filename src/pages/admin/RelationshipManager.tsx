import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, Settings, UserPlus, CalendarClock, AlertTriangle, Target, Copy, Save, CalendarPlus } from "lucide-react";
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
};
const OFFERS: Record<string, string> = {
  nenhuma: "Nenhuma",
  outro_guia: "Outro Guia",
  treino_express: "Treino Express",
  plano_pro: "Plano PRO",
};
const CHANNELS: Record<string, string> = { whatsapp: "WhatsApp", email: "E-mail", ligacao: "Ligação", app: "App" };
const HISTORY_TYPES: Record<string, string> = {
  compra: "Compra",
  email_automatico: "E-mail automático",
  email_manual: "E-mail manual",
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  resposta_cliente: "Resposta do cliente",
  oferta_enviada: "Oferta enviada",
  venda: "Venda",
  observacao_interna: "Observação interna",
};
const STEPS = [0, 1, 3, 7, 14, 30];
const DEFAULT_MESSAGES: Record<string, string> = {
  "0": "Oi, [nome]. Seu acesso já está liberado. Comece pelo primeiro bloco e use as frases como ferramenta, não como matéria para decorar.",
  "1": "Conseguiu entrar no produto? Hoje eu faria uma coisa só: escolha 3 respostas que você realmente usaria e fale cada uma em voz alta.",
  "3": "Uma dica: não tente consumir tudo de uma vez. Pegue uma situação em que você costuma travar e treine só as respostas daquela situação. Já conseguiu testar alguma?",
  "7": "Você já está há uma semana com o produto. Qual situação ainda te trava mais: conversa, trabalho, viagem ou entender respostas rápidas?",
  "14": "Pelo que você vem praticando, talvez faça sentido dar o próximo passo. Temos treinos mais focados para quem quer praticar uma situação específica com mais profundidade.",
  "30": "Se sua necessidade agora é praticar com frequência e receber acompanhamento, o próximo passo pode ser o Plano PRO.",
};
const DEFAULT_ENGAGEMENT = { medium: 300, high: 1500, recent_events: 5 };
const NONE = "__none__";
const ALL = "all";

type Purchase = { product_key: string | null; name: string; included: string[]; included_keys: string[]; paid_at: string; value_cents: number };
type Relationship = {
  stage: string;
  responsible_id: string | null;
  preferred_channel: string | null;
  next_offer: string;
  next_offer_notes: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  internal_notes: string | null;
};
type Customer = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan_tier: string | null;
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
  relationship: Relationship | null;
};
type Admin = { user_id: string; name: string };
type HistoryRow = { id: string; type: string; channel: string | null; responsible_id: string | null; notes: string | null; created_at: string };

const emptyRel: Relationship = {
  stage: "novo_cliente",
  responsible_id: null,
  preferred_channel: null,
  next_offer: "nenhuma",
  next_offer_notes: null,
  last_contact_at: null,
  next_contact_at: null,
  internal_notes: null,
};

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const daysSince = (v?: string | null) => (v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null);
const toLocalInput = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function dueStatus(v?: string | null): "overdue" | "today" | "future" | "none" {
  if (!v) return "none";
  const d = new Date(v);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (d < start) return "overdue";
  if (d < end) return "today";
  return "future";
}

function cadence(lastPurchase?: string | null) {
  const days = daysSince(lastPurchase);
  if (days === null) return { days: null, current: null as number | null, next: null as number | null };
  const current = [...STEPS].reverse().find((s) => s <= days) ?? 0;
  const next = STEPS.find((s) => s > days) ?? null;
  return { days, current, next };
}

function productNames(c: Customer) {
  const names = new Set<string>();
  c.purchases.forEach((p) => names.add(p.name));
  c.subscriptions.forEach((s) => names.add(s.name));
  return [...names];
}

export default function RelationshipManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [engagement, setEngagement] = useState(DEFAULT_ENGAGEMENT);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stageF, setStageF] = useState(ALL);
  const [productF, setProductF] = useState(ALL);
  const [respF, setRespF] = useState(ALL);
  const [dueF, setDueF] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: settings }] = await Promise.all([
      (supabase as any).rpc("get_relationship_customers"),
      supabase.from("relationship_settings").select("key, value"),
    ]);
    if (error) toast.error("Não foi possível carregar os clientes.");
    const payload = (data ?? {}) as { customers?: Customer[]; admins?: Admin[] };
    setCustomers(
      (payload.customers ?? []).sort((a, b) => (b.last_purchase_at ?? "").localeCompare(a.last_purchase_at ?? "")),
    );
    setAdmins(payload.admins ?? []);
    (settings ?? []).forEach((s: any) => {
      if (s.key === "messages") setMessages({ ...DEFAULT_MESSAGES, ...(s.value as any) });
      if (s.key === "engagement") setEngagement({ ...DEFAULT_ENGAGEMENT, ...(s.value as any) });
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const adminName = (id?: string | null) => admins.find((a) => a.user_id === id)?.name ?? "—";
  const engagementLevel = (xp: number) => (xp >= engagement.high ? "Alto" : xp >= engagement.medium ? "Médio" : "Baixo");

  const signals = (c: Customer) => {
    const out: string[] = [];
    const rel = c.relationship ?? emptyRel;
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
    if (days !== null && days >= 7 && days < 14) out.push("Chegou no D+7");
    if (days !== null && days >= 14 && days < 30) out.push("Chegou no D+14");
    if (dueStatus(rel.next_contact_at) === "overdue") out.push("Contato vencido");
    return out;
  };

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      c.purchases.forEach((p) => p.product_key && map.set(p.product_key, p.name));
      c.subscriptions.forEach((s) => s.product_key && map.set(s.product_key, s.name));
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const rel = c.relationship ?? emptyRel;
      if (q && !(c.name ?? "").toLowerCase().includes(q) && !(c.email ?? "").toLowerCase().includes(q)) return false;
      if (stageF !== ALL && rel.stage !== stageF) return false;
      if (respF === NONE && rel.responsible_id) return false;
      if (respF !== ALL && respF !== NONE && rel.responsible_id !== respF) return false;
      if (dueF !== ALL && dueStatus(rel.next_contact_at) !== dueF) return false;
      if (productF !== ALL) {
        const keys = [
          ...c.purchases.flatMap((p) => [p.product_key, ...(p.included_keys ?? [])]),
          ...c.subscriptions.map((s) => s.product_key),
        ];
        if (!keys.includes(productF)) return false;
      }
      return true;
    });
  }, [customers, query, stageF, respF, dueF, productF]);

  const summary = useMemo(() => {
    let novos = 0, hoje = 0, atrasados = 0, pro = 0;
    customers.forEach((c) => {
      const rel = c.relationship ?? emptyRel;
      if (rel.stage === "novo_cliente") novos++;
      const d = dueStatus(rel.next_contact_at);
      if (d === "today") hoje++;
      if (d === "overdue") atrasados++;
      if (rel.stage === "oportunidade_pro" || rel.next_offer === "plano_pro") pro++;
    });
    return { novos, hoje, atrasados, pro };
  }, [customers]);

  const selected = customers.find((c) => c.user_id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Relacionamento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe compradores, próximos contatos e oportunidades. Nada é enviado automaticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4 mr-1.5" /> Régua e engajamento
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={UserPlus} label="Clientes novos" value={summary.novos} onClick={() => setStageF("novo_cliente")} />
        <SummaryCard icon={CalendarClock} label="Contatos de hoje" value={summary.hoje} onClick={() => setDueF("today")} />
        <SummaryCard icon={AlertTriangle} label="Contatos atrasados" value={summary.atrasados} tone="destructive" onClick={() => setDueF("overdue")} />
        <SummaryCard icon={Target} label="Oportunidades Plano PRO" value={summary.pro} onClick={() => setStageF("oportunidade_pro")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
        </div>
        <FilterSelect label="Etapa" value={stageF} onChange={setStageF} options={Object.entries(STAGES)} />
        <FilterSelect label="Produto" value={productF} onChange={setProductF} options={productOptions} />
        <FilterSelect
          label="Responsável"
          value={respF}
          onChange={setRespF}
          options={[[NONE, "Sem responsável"], ...admins.map((a) => [a.user_id, a.name] as [string, string])]}
        />
        <FilterSelect
          label="Próximo contato"
          value={dueF}
          onChange={setDueF}
          options={[["overdue", "Vencido"], ["today", "Hoje"], ["future", "Futuro"], ["none", "Sem data"]]}
        />
        {(stageF !== ALL || productF !== ALL || respF !== ALL || dueF !== ALL || query) && (
          <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setStageF(ALL); setProductF(ALL); setRespF(ALL); setDueF(ALL); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
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
                  <TableHead>Canal</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Próxima oferta</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => {
                  const rel = c.relationship ?? emptyRel;
                  const due = dueStatus(rel.next_contact_at);
                  const sig = signals(c);
                  return (
                    <TableRow key={c.user_id} className="cursor-pointer" onClick={() => setSelectedId(c.user_id)}>
                      <TableCell className="min-w-[200px]">
                        <div className="font-medium text-foreground">{c.name || "(sem nome)"}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                        {sig.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {sig.map((s) => (
                              <Badge key={s} variant={s === "Contato vencido" ? "destructive" : "secondary"} className="text-[10px]">{s}</Badge>
                            ))}
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
                      <TableCell className="text-xs">{rel.preferred_channel ? CHANNELS[rel.preferred_channel] : "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <span className="font-semibold tabular-nums">{c.xp.toLocaleString("pt-BR")}</span>
                        <div className="text-muted-foreground">{engagementLevel(c.xp)}</div>
                      </TableCell>
                      <TableCell className="text-xs">{OFFERS[rel.next_offer]}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{adminName(rel.responsible_id)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {!loading && <p className="text-xs text-muted-foreground">{filtered.length} de {customers.length} cliente(s)</p>}

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <CustomerSheet
              key={selected.user_id}
              customer={selected}
              admins={admins}
              messages={messages}
              engagementLevel={engagementLevel(selected.xp)}
              signals={signals(selected)}
              onSaved={load}
            />
          )}
        </SheetContent>
      </Sheet>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        messages={messages}
        engagement={engagement}
        onSaved={(m, e) => { setMessages(m); setEngagement(e); }}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, onClick }: { icon: any; label: string; value: number; tone?: "destructive"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="p-4 hover:border-primary/60 transition-colors">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={cn("h-4 w-4", tone === "destructive" ? "text-destructive" : "text-primary")} /> {label}
        </div>
        <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "destructive" && value > 0 ? "text-destructive" : "text-foreground")}>{value}</p>
      </Card>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[180px]" aria-label={`Filtrar por ${label}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>{l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CustomerSheet({
  customer: c,
  admins,
  messages,
  engagementLevel,
  signals,
  onSaved,
}: {
  customer: Customer;
  admins: Admin[];
  messages: Record<string, string>;
  engagementLevel: string;
  signals: string[];
  onSaved: () => void;
}) {
  const [rel, setRel] = useState<Relationship>({ ...emptyRel, ...(c.relationship ?? {}) });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [contact, setContact] = useState({ type: "whatsapp", channel: "whatsapp", notes: "", responsible_id: rel.responsible_id ?? NONE });
  const [registering, setRegistering] = useState(false);
  const cad = cadence(c.last_purchase_at);
  const messageStep = cad.current ?? 0;
  const firstName = (c.name || "").split(" ")[0] || "aluno";
  const suggested = (messages[String(messageStep)] ?? "").split("[nome]").join(firstName);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("customer_relationship_history")
      .select("id, type, channel, responsible_id, notes, created_at")
      .eq("user_id", c.user_id)
      .order("created_at", { ascending: false });
    setHistory((data as HistoryRow[]) ?? []);
  };
  useEffect(() => {
    loadHistory();
  }, [c.user_id]);

  const timeline = useMemo(() => {
    const purchases = c.purchases.map((p, i) => ({
      id: `p${i}`,
      type: "compra",
      channel: null,
      responsible_id: null,
      notes: `Comprou ${p.name}${p.included?.length ? ` (${p.included.join(", ")})` : ""}`,
      created_at: p.paid_at,
    }));
    return [...history, ...purchases].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [history, c.purchases]);

  const persist = async (patch: Partial<Relationship>) => {
    const { error } = await supabase
      .from("customer_relationships")
      .upsert({ user_id: c.user_id, ...rel, ...patch } as any, { onConflict: "user_id" });
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
    setRel({ ...rel, next_contact_at: d.toISOString() });
    toast.info(`Próximo contato sugerido para D+${cad.next}. Clique em Salvar ficha.`);
  };

  const register = async () => {
    if (!contact.notes.trim()) {
      toast.error("Escreva uma observação para registrar o contato.");
      return;
    }
    setRegistering(true);
    const { data: me } = await supabase.auth.getUser();
    const responsible = contact.responsible_id === NONE ? null : contact.responsible_id;
    const { error } = await supabase.from("customer_relationship_history").insert({
      user_id: c.user_id,
      type: contact.type,
      channel: contact.channel,
      responsible_id: responsible,
      notes: contact.notes.trim(),
      created_by: me.user?.id ?? null,
    });
    if (!error && contact.type !== "observacao_interna") {
      const now = new Date().toISOString();
      try {
        await persist({ last_contact_at: now });
        setRel((r) => ({ ...r, last_contact_at: now }));
      } catch {
        /* histórico já foi salvo */
      }
    }
    setRegistering(false);
    if (error) {
      toast.error("Não foi possível registrar o contato.");
      return;
    }
    toast.success("Contato registrado.");
    setContact({ ...contact, notes: "" });
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
          {signals.map((s) => (
            <Badge key={s} variant={s === "Contato vencido" ? "destructive" : "secondary"}>{s}</Badge>
          ))}
        </div>
      </SheetHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Info label="XP" value={c.xp.toLocaleString("pt-BR")} helper={`${engagementLevel} engajamento`} />
        <Info label="Último acesso" value={fmtDate(c.last_activity)} />
        <Info label="Acessos BST" value={String(c.bst_products)} helper={`${c.course_access} curso(s)`} />
        <Info label="Uso 7 dias" value={String(c.recent_events)} helper="atividades com XP" />
      </div>

      <Section title="Produtos e compras">
        <div className="space-y-1.5">
          {c.purchases.map((p, i) => (
            <div key={i} className="flex justify-between gap-3 text-sm">
              <span>
                {p.name}
                {p.included?.length > 0 && <span className="text-xs text-muted-foreground"> — {p.included.join(", ")}</span>}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.paid_at)}</span>
            </div>
          ))}
          {c.subscriptions.map((s, i) => (
            <div key={`s${i}`} className="flex justify-between gap-3 text-sm">
              <span>{s.name} <Badge variant="outline" className="text-[10px] ml-1">{s.status}</Badge></span>
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
              <span
                key={s}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  isCurrent ? "bg-primary text-primary-foreground border-primary" : done ? "bg-muted text-muted-foreground" : "text-foreground",
                )}
              >
                {s === 0 ? "D0" : `D+${s}`}
              </span>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {cad.days === null
            ? "Sem data de compra."
            : `Compra há ${cad.days} dia(s). ${cad.next !== null ? `Próximo marco previsto: D+${cad.next}.` : "Régua concluída."}`}
        </p>
        {cad.next !== null && (
          <Button size="sm" variant="outline" className="mt-2" onClick={scheduleFromCadence}>
            <CalendarPlus className="h-4 w-4 mr-1.5" /> Gerar tarefa D+{cad.next}
          </Button>
        )}
      </Section>

      <Section title={`Mensagem sugerida (${messageStep === 0 ? "D0" : `D+${messageStep}`})`}>
        <p className="text-sm text-foreground whitespace-pre-line">{suggested}</p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 -ml-2"
          onClick={() => { navigator.clipboard.writeText(suggested); toast.success("Mensagem copiada."); }}
        >
          <Copy className="h-4 w-4 mr-1.5" /> Copiar
        </Button>
      </Section>

      <Section title="Acompanhamento">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Etapa">
            <Select value={rel.stage} onValueChange={(v) => setRel({ ...rel, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STAGES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={rel.responsible_id ?? NONE} onValueChange={(v) => setRel({ ...rel, responsible_id: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {admins.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Canal preferido">
            <Select value={rel.preferred_channel ?? NONE} onValueChange={(v) => setRel({ ...rel, preferred_channel: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não definido</SelectItem>
                {Object.entries(CHANNELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Próximo contato">
            <Input
              type="datetime-local"
              value={toLocalInput(rel.next_contact_at)}
              onChange={(e) => setRel({ ...rel, next_contact_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </Field>
          <Field label="Próxima oferta">
            <Select value={rel.next_offer} onValueChange={(v) => setRel({ ...rel, next_offer: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(OFFERS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Motivo / complemento da oferta">
            <Input value={rel.next_offer_notes ?? ""} onChange={(e) => setRel({ ...rel, next_offer_notes: e.target.value })} placeholder="Ex: pediu mais prática de conversação" />
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
            <Select value={contact.type} onValueChange={(v) => setContact({ ...contact, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(HISTORY_TYPES).filter(([k]) => k !== "compra").map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Canal">
            <Select value={contact.channel} onValueChange={(v) => setContact({ ...contact, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CHANNELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={contact.responsible_id} onValueChange={(v) => setContact({ ...contact, responsible_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {admins.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Textarea className="mt-3" rows={2} placeholder="Observação" value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />
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
                {h.notes && <p className="text-sm text-foreground">{h.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
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
  open,
  onOpenChange,
  messages,
  engagement,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  messages: Record<string, string>;
  engagement: typeof DEFAULT_ENGAGEMENT;
  onSaved: (m: Record<string, string>, e: typeof DEFAULT_ENGAGEMENT) => void;
}) {
  const [m, setM] = useState(messages);
  const [e, setE] = useState(engagement);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setM(messages); setE(engagement); }
  }, [open]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("relationship_settings").upsert([
      { key: "messages", value: m, updated_at: new Date().toISOString() },
      { key: "engagement", value: e, updated_at: new Date().toISOString() },
    ] as any);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar."); return; }
    onSaved(m, e);
    toast.success("Configurações salvas.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Régua e engajamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="XP médio a partir de">
              <Input type="number" value={e.medium} onChange={(ev) => setE({ ...e, medium: Number(ev.target.value) })} />
            </Field>
            <Field label="XP alto a partir de">
              <Input type="number" value={e.high} onChange={(ev) => setE({ ...e, high: Number(ev.target.value) })} />
            </Field>
            <Field label="Atividades em 7 dias (uso alto)">
              <Input type="number" value={e.recent_events} onChange={(ev) => setE({ ...e, recent_events: Number(ev.target.value) })} />
            </Field>
          </div>
          {STEPS.map((s) => (
            <Field key={s} label={s === 0 ? "Mensagem D0" : `Mensagem D+${s}`}>
              <Textarea rows={2} value={m[String(s)] ?? ""} onChange={(ev) => setM({ ...m, [String(s)]: ev.target.value })} />
            </Field>
          ))}
          <p className="text-xs text-muted-foreground">Use [nome] para inserir o primeiro nome do cliente.</p>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
