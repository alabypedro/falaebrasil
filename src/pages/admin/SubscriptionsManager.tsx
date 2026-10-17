import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, Wallet, Archive, XCircle, RefreshCw } from "lucide-react";

type Sub = {
  asaas_subscription_id: string;
  user_id: string | null;
  product_key: string | null;
  status: string | null;
  cycle: string | null;
  value_cents: number | null;
  next_due_date: string | null;
  canceled_at: string | null;
};

type ProfileInfo = { user_id: string; display_name: string | null; email: string | null };

const BRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null) =>
  d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "—";

function statusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return <Badge className="bg-emerald-600">Ativa</Badge>;
  if (s === "overdue") return <Badge variant="destructive">Em atraso</Badge>;
  if (s === "canceled" || s === "inactive") return <Badge variant="secondary">Encerrada</Badge>;
  return <Badge variant="outline">{status ?? "—"}</Badge>;
}

export default function SubscriptionsManager() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [confirmedThisMonth, setConfirmedThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: subData, error } = await supabase
      .from("asaas_subscriptions")
      .select("asaas_subscription_id, user_id, product_key, status, cycle, value_cents, next_due_date, canceled_at")
      .order("next_due_date", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar assinaturas");
      setLoading(false);
      return;
    }
    const list = (subData ?? []) as Sub[];
    setSubs(list);

    const ids = [...new Set(list.map((s) => s.user_id).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", ids);
      setProfiles(new Map(((profs ?? []) as ProfileInfo[]).map((p) => [p.user_id, p])));
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    const { data: pays } = await supabase
      .from("asaas_payments")
      .select("value_cents")
      .not("asaas_subscription_id", "is", null)
      .in("status", ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])
      .gte("created_at", monthStart.toISOString());
    setConfirmedThisMonth((pays ?? []).reduce((acc, p) => acc + (p.value_cents ?? 0), 0));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const active = useMemo(
    () => subs.filter((s) => ["active", "overdue"].includes((s.status ?? "").toLowerCase())),
    [subs],
  );
  const archived = useMemo(
    () => subs.filter((s) => !["active", "overdue"].includes((s.status ?? "").toLowerCase())),
    [subs],
  );
  const mrr = active.reduce((acc, s) => acc + (s.value_cents ?? 0), 0);

  const handleCancel = async (sub: Sub) => {
    const prof = sub.user_id ? profiles.get(sub.user_id) : null;
    const label = prof?.display_name ?? prof?.email ?? sub.asaas_subscription_id;
    if (!confirm(`Cancelar a assinatura de ${label}? O acesso segue até o fim do período já pago.`)) return;
    setBusyId(sub.asaas_subscription_id);
    const { data, error } = await supabase.functions.invoke("asaas-cancel-subscription", {
      body: { subscription_id: sub.asaas_subscription_id },
    });
    setBusyId(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erro ao cancelar assinatura");
      return;
    }
    toast.success("Assinatura cancelada");
    load();
  };

  const renderRow = (s: Sub, showCancel: boolean) => {
    const prof = s.user_id ? profiles.get(s.user_id) : null;
    return (
      <li key={s.asaas_subscription_id} className="flex flex-wrap items-center gap-3 py-3 border-b last:border-0">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {prof?.display_name ?? prof?.email ?? "Aluno sem perfil vinculado"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {s.product_key ?? "—"} · próx. vencimento {fmtDate(s.next_due_date)}
            {s.canceled_at ? ` · encerrada em ${fmtDate(s.canceled_at)}` : ""}
          </div>
        </div>
        <div className="text-sm font-medium">{s.value_cents != null ? BRL(s.value_cents) : "—"}</div>
        {statusBadge(s.status)}
        {showCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={busyId === s.asaas_subscription_id}
            onClick={() => handleCancel(s)}
          >
            {busyId === s.asaas_subscription_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </Button>
        )}
      </li>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assinaturas PRO</h1>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Assinantes ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{active.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Recebível mensal previsto
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{BRL(mrr)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Confirmado neste mês
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{BRL(confirmedThisMonth)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alunos ativos pagantes</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa no momento.</p>
          ) : (
            <ul>{active.map((s) => renderRow(s, true))}</ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="h-4 w-4" /> Arquivo morto (ex-assinantes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {archived.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura encerrada.</p>
          ) : (
            <ul>{archived.map((s) => renderRow(s, false))}</ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
