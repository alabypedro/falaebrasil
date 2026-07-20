import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Search } from "lucide-react";

interface WebhookEvent {
  event_id: string;
  event_type: string;
  status: string;
  payment_id: string | null;
  subscription_id: string | null;
  user_id: string | null;
  error: string | null;
  result: any;
  raw_payload: any;
  processed_at: string;
}

const statusColor = (s: string) => {
  if (s === "processed") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (s === "failed") return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
  if (s === "processing") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground";
};

export default function WebhookLogsManager() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WebhookEvent | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("asaas_webhook_events")
      .select("*")
      .order("processed_at", { ascending: false })
      .limit(200);
    setEvents((data ?? []) as WebhookEvent[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = events.filter((e) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      e.event_type?.toLowerCase().includes(s) ||
      e.status?.toLowerCase().includes(s) ||
      e.payment_id?.toLowerCase().includes(s) ||
      e.subscription_id?.toLowerCase().includes(s) ||
      e.event_id?.toLowerCase().includes(s) ||
      e.user_id?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Logs do Webhook ASAAS</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Últimos 200 eventos recebidos, com status de processamento e payload completo.
            </p>
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por evento, id, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2 font-medium">Quando</th>
                  <th className="p-2 font-medium">Evento</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Payment ID</th>
                  <th className="p-2 font-medium">Subscription ID</th>
                  <th className="p-2 font-medium">Usuário</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.event_id} className="border-t hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      {new Date(e.processed_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2 font-mono text-xs">{e.event_type}</td>
                    <td className="p-2">
                      <Badge variant="outline" className={statusColor(e.status)}>
                        {e.status}
                      </Badge>
                      {e.error && (
                        <div className="text-xs text-red-600 mt-1 max-w-[200px] truncate" title={e.error}>
                          {e.error}
                        </div>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{e.payment_id ?? "—"}</td>
                    <td className="p-2 font-mono text-xs">{e.subscription_id ?? "—"}</td>
                    <td className="p-2 font-mono text-xs">{e.user_id?.slice(0, 8) ?? "—"}</td>
                    <td className="p-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(e)}>
                        Ver payload
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Nenhum evento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {selected?.event_type} • {selected?.event_id}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={statusColor(selected.status)}>{selected.status}</Badge></div>
                <div><span className="text-muted-foreground">Quando:</span> {new Date(selected.processed_at).toLocaleString("pt-BR")}</div>
                <div><span className="text-muted-foreground">Payment ID:</span> <span className="font-mono">{selected.payment_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Subscription ID:</span> <span className="font-mono">{selected.subscription_id ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">User ID:</span> <span className="font-mono">{selected.user_id ?? "—"}</span></div>
              </div>
              {selected.error && (
                <div>
                  <div className="font-medium mb-1">Erro</div>
                  <pre className="bg-red-500/10 text-red-700 dark:text-red-300 rounded p-3 text-xs whitespace-pre-wrap">{selected.error}</pre>
                </div>
              )}
              <div>
                <div className="font-medium mb-1">Resultado do processamento</div>
                <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(selected.result, null, 2)}
                </pre>
              </div>
              <div>
                <div className="font-medium mb-1">Payload recebido</div>
                <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(selected.raw_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}