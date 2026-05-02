import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, ShieldCheck, UserPlus, KeyRound } from "lucide-react";

type AdminEntry = { user_id: string; email: string | null };

const ACCESS_OPTIONS: { id: string; label: string }[] = [
  { id: "has_course_access", label: "FB Básico PRO (A1)" },
  { id: "has_ebook1_access", label: "Ebook 1" },
  { id: "has_ebook2_access", label: "Ebook 2" },
  { id: "has_ebook3_access", label: "Ebook 3" },
];

export default function AdminsManager() {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [grantBusy, setGrantBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "list" },
    });
    if (error) toast.error("Erro ao carregar admins");
    else setAdmins(data?.admins ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "add", email: email.trim() },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erro ao adicionar admin");
      return;
    }
    toast.success("Admin adicionado");
    setEmail("");
    load();
  };

  const handleRemove = async (targetEmail: string | null) => {
    if (!targetEmail) return;
    if (!confirm(`Remover admin: ${targetEmail}?`)) return;
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "remove", email: targetEmail },
    });
    if (error || data?.error) {
      toast.error(data?.error ?? "Erro ao remover admin");
      return;
    }
    toast.success("Admin removido");
    load();
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const accesses = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!grantEmail.trim()) return;
    if (accesses.length === 0) {
      toast.error("Selecione ao menos um acesso");
      return;
    }
    setGrantBusy(true);
    const { data, error } = await supabase.functions.invoke("grant-access-admin", {
      body: { email: grantEmail.trim(), accesses, grant: true },
    });
    setGrantBusy(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erro ao liberar acesso");
      return;
    }
    toast.success("Acesso liberado com sucesso");
    setGrantEmail("");
    setSelected({});
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Adicionar admin por email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            O usuário precisa já ter uma conta cadastrada com esse email.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Liberar acesso por email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGrantAccess} className="space-y-4">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCESS_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={!!selected[opt.id]}
                    onCheckedChange={(v) =>
                      setSelected((s) => ({ ...s, [opt.id]: !!v }))
                    }
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            <Button type="submit" disabled={grantBusy} className="w-full sm:w-auto">
              {grantBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Liberar acesso"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            O usuário precisa já ter uma conta cadastrada com esse email. O acesso será liberado imediatamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Administradores atuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum admin encontrado.</p>
          ) : (
            <ul className="divide-y">
              {admins.map((a) => (
                <li key={a.user_id} className="flex items-center justify-between py-3 gap-2">
                  <span className="text-sm break-all">{a.email ?? a.user_id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(a.email)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}