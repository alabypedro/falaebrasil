import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UserPlus, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StudentAccessDialog from "@/components/admin/StudentAccessDialog";
import CreateStudent from "@/pages/admin/CreateStudent";
import WelcomeEmailSender from "@/pages/admin/WelcomeEmailSender";

const PAGE_SIZE = 12;

interface CategoryDef {
  code: string;
  label: string;
  kind: "open" | "bst";
  display_order: number;
}

interface StudentRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  plan_tier: string | null;
  subscription_status: string | null;
  subscription_grace_until: string | null;
  codes: string[];
}

/** Aluno inativo por inadimplência: só se depender de assinatura (categoria OPEN). */
function isActive(s: StudentRow, defs: CategoryDef[]) {
  const kinds = s.codes.map((c) => defs.find((d) => d.code === c)?.kind);
  const hasOpen = kinds.includes("open");
  // Compra única (BST) = acesso vitalício.
  if (!hasOpen) return true;
  const status = (s.subscription_status ?? "").toLowerCase();
  if (["active", "trialing", "authorized"].includes(status)) return true;
  if (s.subscription_grace_until && new Date(s.subscription_grace_until) > new Date()) return true;
  return status === "" || status === "none" ? true : false;
}

export default function StudentsManager() {
  const [defs, setDefs] = useState<CategoryDef[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<StudentRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: defRows }, { data: profileRows }, { data: catRows }] = await Promise.all([
      supabase.from("student_category_defs").select("code, label, kind, display_order"),
      supabase
        .from("profiles")
        .select("user_id, display_name, email, plan_tier, subscription_status, subscription_grace_until"),
      supabase.from("student_categories").select("user_id, code"),
    ]);

    const catsByUser = new Map<string, string[]>();
    ((catRows as any[]) ?? []).forEach((r) => {
      catsByUser.set(r.user_id, [...(catsByUser.get(r.user_id) ?? []), r.code]);
    });

    setDefs(
      (((defRows as any[]) ?? []) as CategoryDef[]).sort(
        (a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)
      )
    );
    setStudents(
      (((profileRows as any[]) ?? []) as any[])
        .map((p) => ({ ...p, codes: catsByUser.get(p.user_id) ?? [] }))
        .sort((a, b) =>
          (a.display_name || a.email || "").localeCompare(b.display_name || b.email || "", "pt-BR")
        )
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.display_name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);


  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Alunos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os alunos cadastrados, suas categorias (OPEN, BST1, BST2...) e situação de acesso.
          Alterar a categoria muda as permissões no portal imediatamente.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar por nome ou email..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Criar aluno
        </Button>
        <Button variant="outline" onClick={() => setWelcomeOpen(true)}>
          <Mail className="h-4 w-4 mr-1.5" /> Envio manual
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Criar aluno</DialogTitle>
          </DialogHeader>
          <CreateStudent onCreated={load} />
        </DialogContent>
      </Dialog>

      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Reenviar email de boas-vindas</DialogTitle>
          </DialogHeader>
          <WelcomeEmailSender />
        </DialogContent>
      </Dialog>

      {accessTarget && (
        <StudentAccessDialog
          open={!!accessTarget}
          onOpenChange={(v) => !v && setAccessTarget(null)}
          email={accessTarget.email ?? ""}
          userId={accessTarget.user_id}
          displayName={accessTarget.display_name}
          categoryDefs={defs}
          onChanged={load}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0 divide-y">
              {pageRows.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum aluno encontrado.
                </div>
              )}
              {pageRows.map((s) => {
                const active = isActive(s, defs);
                return (
                  <div key={s.user_id} className="flex flex-wrap items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => s.email && setAccessTarget(s)}
                      disabled={!s.email}
                      className="min-w-0 flex-1 text-left rounded-md px-2 py-1 -mx-2 hover:bg-muted/50 transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
                    >
                      <div className="text-sm font-medium text-foreground truncate">
                        {s.display_name || "(sem nome)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.email || "—"}</div>
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {s.codes.length === 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          Sem categoria
                        </Badge>
                      ) : (
                        s.codes
                          .slice()
                          .sort()
                          .map((code) => (
                            <Badge key={code} variant="secondary" className="text-[10px] border-0 uppercase">
                              {defs.find((d) => d.code === code)?.label ?? code}
                            </Badge>
                          ))
                      )}
                    </div>

                    <Badge
                      variant={active ? "secondary" : "destructive"}
                      className="text-[10px] shrink-0"
                    >
                      {active ? "Aluno ativo" : "Inativo por inadimplência"}
                    </Badge>

                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {filtered.length} aluno(s) · página {currentPage} de {totalPages}
            </span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={n === currentPage ? "default" : "outline"}
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
