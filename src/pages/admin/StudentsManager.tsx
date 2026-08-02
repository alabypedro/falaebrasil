import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const [busy, setBusy] = useState<string | null>(null);

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

  const toggleCategory = async (student: StudentRow, def: CategoryDef, checked: boolean) => {
    setBusy(student.user_id + def.code);
    try {
      if (checked) {
        const { error } = await supabase
          .from("student_categories")
          .insert({ user_id: student.user_id, code: def.code, source: "admin" });
        if (error && error.code !== "23505") throw error;
        // OPEN libera tudo e não coexiste com categorias BST.
        if (def.kind === "open") {
          // Regra: aluno OPEN tem acesso a TUDO (cursos inclusos).
          if (student.email) {
            await supabase.functions.invoke("grant-access-admin", {
              body: {
                email: student.email,
                accesses: ["has_course_access"],
                plan_tier: "open",
                grant: true,
              },
            });
          }
          const bstCodes = defs.filter((d) => d.kind === "bst").map((d) => d.code);
          if (bstCodes.length) {
            await supabase
              .from("student_categories")
              .delete()
              .eq("user_id", student.user_id)
              .in("code", bstCodes);
          }
        } else {
          const openCodes = defs.filter((d) => d.kind === "open").map((d) => d.code);
          if (openCodes.length) {
            await supabase
              .from("student_categories")
              .delete()
              .eq("user_id", student.user_id)
              .in("code", openCodes);
          }
        }
      } else {
        const { error } = await supabase
          .from("student_categories")
          .delete()
          .eq("user_id", student.user_id)
          .eq("code", def.code);
        if (error) throw error;
      }
      await load();
      toast({ title: "Categorias atualizadas" });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Alunos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os alunos cadastrados, suas categorias (OPEN, BST1, BST2...) e situação de acesso.
          Alterar a categoria muda as permissões no portal imediatamente.
        </p>
      </div>

      <div className="relative max-w-sm">
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
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {s.display_name || "(sem nome)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.email || "—"}</div>
                    </div>

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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="shrink-0">
                          <Settings2 className="h-4 w-4 mr-1.5" />
                          Categorias
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Categorias do aluno</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-2 space-y-2">
                          {defs.map((d) => (
                            <label
                              key={d.code}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={s.codes.includes(d.code)}
                                disabled={busy === s.user_id + d.code}
                                onCheckedChange={(v) => toggleCategory(s, d, !!v)}
                              />
                              <span className="truncate">{d.label}</span>
                            </label>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
