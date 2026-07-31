import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, ShieldCheck, UserPlus, KeyRound, Users } from "lucide-react";

type AdminEntry = { user_id: string; email: string | null };

interface CourseRow {
  id: string;
  title: string;
  level: string;
  required_tier: string | null;
  display_order: number;
}

interface BstRow {
  id: string;
  title: string;
}

const GROUPS = [
  { key: "adults", title: "Cursos Adultos (A1 → C2)", tiers: ["open", "pro", "vip"] },
  { key: "teens", title: "Cursos Teens 1 ao 4", tiers: ["teens"] },
  { key: "kids", title: "Cursos Kids 1 ao 4", tiers: ["kids"] },
] as const;

export default function AdminsManager() {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [bstProducts, setBstProducts] = useState<BstRow[]>([]);
  const [selCourses, setSelCourses] = useState<Record<string, boolean>>({});
  const [selBst, setSelBst] = useState<Record<string, boolean>>({});
  const [grantBusy, setGrantBusy] = useState(false);
  const [bulkCourses, setBulkCourses] = useState<Record<string, boolean>>({});
  const [bulkBst, setBulkBst] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

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

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: b }] = await Promise.all([
        supabase
          .from("courses")
          .select("id,title,level,required_tier,display_order")
          .eq("published", true)
          .order("display_order"),
        supabase.from("bst_products").select("id,title").eq("active", true),
      ]);
      setCourses((c as CourseRow[]) ?? []);
      setBstProducts(
        ((b as BstRow[]) ?? []).sort((x, y) => x.title.localeCompare(y.title, "pt-BR")),
      );
    })();
  }, []);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: courses.filter((c) =>
          (g.tiers as readonly string[]).includes((c.required_tier ?? "open").toLowerCase()),
        ),
      })).filter((g) => g.items.length > 0),
    [courses],
  );

  const idsOf = (rec: Record<string, boolean>) =>
    Object.keys(rec).filter((k) => rec[k]);

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
    const courseIds = idsOf(selCourses);
    const bstIds = idsOf(selBst);
    if (!grantEmail.trim()) return;
    if (courseIds.length === 0 && bstIds.length === 0) {
      toast.error("Selecione ao menos um acesso");
      return;
    }
    setGrantBusy(true);
    const { data, error } = await supabase.functions.invoke("grant-access-admin", {
      body: {
        email: grantEmail.trim(),
        accesses: [],
        course_ids: courseIds,
        bst_product_ids: bstIds,
        grant: true,
      },
    });
    setGrantBusy(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erro ao liberar acesso");
      return;
    }
    toast.success("Acesso liberado com sucesso");
    setGrantEmail("");
    setSelCourses({});
    setSelBst({});
  };

  const handleBulkGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseIds = idsOf(bulkCourses);
    const bstIds = idsOf(bulkBst);
    if (courseIds.length === 0 && bstIds.length === 0) {
      toast.error("Selecione ao menos um entregável");
      return;
    }
    const labels = [
      ...courses.filter((c) => courseIds.includes(c.id)).map((c) => c.title),
      ...bstProducts.filter((p) => bstIds.includes(p.id)).map((p) => p.title),
    ].join(", ");
    if (!confirm(`Liberar [${labels}] para TODOS os usuários cadastrados? Esta ação é irreversível em massa.`)) {
      return;
    }
    setBulkBusy(true);
    const { data, error } = await supabase.functions.invoke("grant-access-bulk", {
      body: { accesses: [], course_ids: courseIds, bst_product_ids: bstIds, grant: true },
    });
    setBulkBusy(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erro ao liberar acesso em massa");
      return;
    }
    toast.success(`Acesso liberado para todos os usuários${data?.affected ? ` (${data.affected} perfis)` : ""}`);
    setBulkCourses({});
    setBulkBst({});
  };

  const AccessPicker = ({
    selCourse,
    setSelCourse,
    selBstState,
    setSelBstState,
  }: {
    selCourse: Record<string, boolean>;
    setSelCourse: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    selBstState: Record<string, boolean>;
    setSelBstState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  }) => (
    <div className="space-y-4">
      {grouped.map((g) => (
        <div key={g.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">{g.title}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSelCourse((s) => {
                    const n = { ...s };
                    g.items.forEach((i) => (n[i.id] = true));
                    return n;
                  })
                }
              >
                Todos
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() =>
                  setSelCourse((s) => {
                    const n = { ...s };
                    g.items.forEach((i) => (n[i.id] = false));
                    return n;
                  })
                }
              >
                Nenhum
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {g.items.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={!!selCourse[c.id]}
                  onCheckedChange={(v) => setSelCourse((s) => ({ ...s, [c.id]: !!v }))}
                />
                <span className="text-sm">{c.title}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {bstProducts.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Biblioteca BST
          </span>
          <div className="grid gap-2">
            {bstProducts.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={!!selBstState[p.id]}
                  onCheckedChange={(v) => setSelBstState((s) => ({ ...s, [p.id]: !!v }))}
                />
                <span className="text-sm">{p.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

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
            <AccessPicker
              selCourse={selCourses}
              setSelCourse={setSelCourses}
              selBstState={selBst}
              setSelBstState={setSelBst}
            />
            <Button type="submit" disabled={grantBusy} className="w-full sm:w-auto">
              {grantBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Liberar acesso"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            O usuário precisa já ter uma conta cadastrada com esse email. O acesso será liberado
            imediatamente. Produtos BST liberados sozinhos aplicam o mesmo modelo do checkout
            (aluno restrito à Biblioteca BST).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Liberar entregáveis para TODOS os usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBulkGrant} className="space-y-4">
            <AccessPicker
              selCourse={bulkCourses}
              setSelCourse={setBulkCourses}
              selBstState={bulkBst}
              setSelBstState={setBulkBst}
            />
            <Button
              type="submit"
              disabled={bulkBusy}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Liberar para TODOS os usuários"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            ⚠️ Atenção: marca o(s) acesso(s) selecionado(s) como liberado em todos os perfis cadastrados na plataforma. Use com cuidado.
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