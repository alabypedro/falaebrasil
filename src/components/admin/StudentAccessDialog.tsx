import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, ShieldOff, RefreshCw } from "lucide-react";

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

export interface CategoryDef {
  code: string;
  label: string;
  kind: "open" | "bst";
  display_order: number;
}

interface LookupResult {
  email: string;
  display_name: string | null;
  plan_tier: string | null;
  subscription_status: string | null;
  categories: string[];
  courses: { course_id: string; title: string; level: string | null; source: string; granted_at: string }[];
  bst_products: { product_id: string; title: string; source: string; granted_at: string }[];
}

const GROUPS = [
  { key: "adults", title: "Cursos Adultos (A1 → C2)", tiers: ["open", "pro", "vip"] },
  { key: "teens", title: "Cursos Teens 1 ao 4", tiers: ["teens"] },
  { key: "kids", title: "Cursos Kids 1 ao 4", tiers: ["kids"] },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Email do aluno (obrigatório para consultar/liberar). */
  email: string;
  userId?: string | null;
  displayName?: string | null;
  categoryDefs?: CategoryDef[];
  onChanged?: () => void;
}

export default function StudentAccessDialog({
  open,
  onOpenChange,
  email,
  userId,
  displayName,
  categoryDefs,
  onChanged,
}: Props) {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [bstProducts, setBstProducts] = useState<BstRow[]>([]);
  const [defs, setDefs] = useState<CategoryDef[]>(categoryDefs ?? []);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"grant" | "revoke" | "cat" | null>(null);
  const [selCourses, setSelCourses] = useState<Record<string, boolean>>({});
  const [selBst, setSelBst] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: c }, { data: b }, { data: d }] = await Promise.all([
        supabase
          .from("courses")
          .select("id,title,level,required_tier,display_order")
          .eq("published", true)
          .order("display_order"),
        supabase.from("bst_products").select("id,title").eq("active", true),
        categoryDefs?.length
          ? Promise.resolve({ data: categoryDefs })
          : supabase.from("student_category_defs").select("code,label,kind,display_order"),
      ]);
      setCourses((c as CourseRow[]) ?? []);
      setBstProducts(
        ((b as BstRow[]) ?? []).sort((x, y) => x.title.localeCompare(y.title, "pt-BR")),
      );
      setDefs(
        (((d as CategoryDef[]) ?? []) as CategoryDef[])
          .slice()
          .sort((a, z) => a.display_order - z.display_order || a.code.localeCompare(z.code)),
      );
    })();
  }, [open, categoryDefs]);

  const refresh = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("lookup-access-admin", {
      body: { email },
    });
    setLoading(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? "Erro ao consultar acessos");
      setLookup(null);
      return;
    }
    const res = data as LookupResult;
    setLookup(res);
    const cs: Record<string, boolean> = {};
    res.courses.forEach((c) => (cs[c.course_id] = true));
    const bs: Record<string, boolean> = {};
    res.bst_products.forEach((p) => (bs[p.product_id] = true));
    setSelCourses(cs);
    setSelBst(bs);
  }, [email]);

  useEffect(() => {
    if (open) refresh();
    else setLookup(null);
  }, [open, refresh]);

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

  const activeCourseIds = new Set((lookup?.courses ?? []).map((c) => c.course_id));
  const activeBstIds = new Set((lookup?.bst_products ?? []).map((p) => p.product_id));

  const idsOf = (rec: Record<string, boolean>) => Object.keys(rec).filter((k) => rec[k]);

  /** Aplica as diferenças entre o que está marcado e o que já está ativo. */
  const applyChanges = async () => {
    const wantedCourses = idsOf(selCourses);
    const wantedBst = idsOf(selBst);
    const toGrantCourses = wantedCourses.filter((id) => !activeCourseIds.has(id));
    const toGrantBst = wantedBst.filter((id) => !activeBstIds.has(id));
    const toRevokeCourses = [...activeCourseIds].filter((id) => !wantedCourses.includes(id));
    const toRevokeBst = [...activeBstIds].filter((id) => !wantedBst.includes(id));

    if (
      toGrantCourses.length + toGrantBst.length + toRevokeCourses.length + toRevokeBst.length ===
      0
    ) {
      toast.info("Nenhuma alteração para aplicar.");
      return;
    }

    setBusy("grant");
    try {
      if (toGrantCourses.length || toGrantBst.length) {
        const { data, error } = await supabase.functions.invoke("grant-access-admin", {
          body: {
            email,
            accesses: [],
            course_ids: toGrantCourses,
            bst_product_ids: toGrantBst,
            grant: true,
          },
        });
        if (error || (data as { error?: string })?.error)
          throw new Error((data as { error?: string })?.error ?? "Erro ao liberar acesso");
      }
      if (toRevokeCourses.length || toRevokeBst.length) {
        const { data, error } = await supabase.functions.invoke("grant-access-admin", {
          body: {
            email,
            accesses: [],
            course_ids: toRevokeCourses,
            bst_product_ids: toRevokeBst,
            grant: false,
          },
        });
        if (error || (data as { error?: string })?.error)
          throw new Error((data as { error?: string })?.error ?? "Erro ao remover acesso");
      }
      toast.success("Acessos atualizados");
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const revokeAll = async () => {
    if (!lookup) return;
    const courseIds = lookup.courses.map((c) => c.course_id);
    const bstIds = lookup.bst_products.map((p) => p.product_id);
    if (courseIds.length + bstIds.length === 0) {
      toast.info("O aluno não possui acessos liberados.");
      return;
    }
    if (!confirm(`Remover TODOS os acessos de ${email}?`)) return;
    setBusy("revoke");
    try {
      const { data, error } = await supabase.functions.invoke("grant-access-admin", {
        body: {
          email,
          accesses: ["has_course_access"],
          course_ids: courseIds,
          bst_product_ids: bstIds,
          grant: false,
        },
      });
      if (error || (data as { error?: string })?.error)
        throw new Error((data as { error?: string })?.error ?? "Erro ao remover acessos");
      toast.success("Todos os acessos removidos");
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleCategory = async (def: CategoryDef, checked: boolean) => {
    if (!userId) {
      toast.error("Aluno sem conta vinculada — libere um acesso primeiro.");
      return;
    }
    setBusy("cat");
    try {
      const allCourseIds = courses.map((c) => c.id);
      if (checked) {
        const { error } = await supabase
          .from("student_categories")
          .insert({ user_id: userId, code: def.code, source: "admin" });
        if (error && error.code !== "23505") throw error;
        if (def.kind === "open") {
          await supabase.functions.invoke("grant-access-admin", {
            body: {
              email,
              accesses: ["has_course_access"],
              course_ids: allCourseIds,
              plan_tier: ["pro", "vip"].includes((lookup?.plan_tier ?? "").toLowerCase())
                ? lookup?.plan_tier
                : "open",
              grant: true,
            },
          });
          const bstCodes = defs.filter((d) => d.kind === "bst").map((d) => d.code);
          if (bstCodes.length)
            await supabase
              .from("student_categories")
              .delete()
              .eq("user_id", userId)
              .in("code", bstCodes);
        } else {
          const openCodes = defs.filter((d) => d.kind === "open").map((d) => d.code);
          if (openCodes.length)
            await supabase
              .from("student_categories")
              .delete()
              .eq("user_id", userId)
              .in("code", openCodes);
        }
      } else {
        const { error } = await supabase
          .from("student_categories")
          .delete()
          .eq("user_id", userId)
          .eq("code", def.code);
        if (error) throw error;
        // Ao desmarcar "Aluno OPEN", remove todos os cursos liberados.
        if (def.kind === "open") {
          const idsToRevoke = [...activeCourseIds];
          if (idsToRevoke.length) {
            await supabase.functions.invoke("grant-access-admin", {
              body: {
                email,
                accesses: ["has_course_access"],
                course_ids: idsToRevoke,
                grant: false,
              },
            });
          }
        }
      }
      toast.success("Categorias atualizadas");
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Liberar acesso por email
          </DialogTitle>
          <DialogDescription className="break-all">
            {displayName ? `${displayName} — ` : ""}
            {email}
          </DialogDescription>
        </DialogHeader>

        {loading && !lookup ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {lookup && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Plano: {lookup.plan_tier ?? "—"}</Badge>
                  <Badge variant="secondary">
                    Assinatura: {lookup.subscription_status ?? "—"}
                  </Badge>
                  <Badge variant="outline">Cursos ativos: {lookup.courses.length}</Badge>
                  <Badge variant="outline">BST ativos: {lookup.bst_products.length}</Badge>
                </div>
                {defs.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-xs uppercase text-muted-foreground">Categorias</Label>
                    <div className="mt-2 flex flex-wrap gap-4">
                      {defs.map((d) => (
                        <label key={d.code} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={lookup.categories.includes(d.code)}
                            disabled={busy === "cat"}
                            onCheckedChange={(v) => toggleCategory(d, !!v)}
                          />
                          <span>{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {g.title}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() =>
                          setSelCourses((s) => {
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
                          setSelCourses((s) => {
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
                    {g.items.map((c) => {
                      const active = activeCourseIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={!!selCourses[c.id]}
                            onCheckedChange={(v) =>
                              setSelCourses((s) => ({ ...s, [c.id]: !!v }))
                            }
                          />
                          <span className="text-sm flex-1 truncate">{c.title}</span>
                          {active && (
                            <Badge variant="secondary" className="text-[10px] border-0 shrink-0">
                              Ativo
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {bstProducts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Biblioteca BST
                  </span>
                  <div className="grid gap-2">
                    {bstProducts.map((p) => {
                      const active = activeBstIds.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={!!selBst[p.id]}
                            onCheckedChange={(v) => setSelBst((s) => ({ ...s, [p.id]: !!v }))}
                          />
                          <span className="text-sm flex-1 truncate">{p.title}</span>
                          {active && (
                            <Badge variant="secondary" className="text-[10px] border-0 shrink-0">
                              Ativo
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {lookup && (lookup.courses.length > 0 || lookup.bst_products.length > 0) && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Histórico de liberações
                </span>
                <ul className="divide-y rounded-md border border-border">
                  {[
                    ...lookup.courses.map((c) => ({
                      label: `${c.title}${c.level ? ` (${c.level})` : ""}`,
                      source: c.source,
                      at: c.granted_at,
                    })),
                    ...lookup.bst_products.map((p) => ({
                      label: p.title,
                      source: p.source,
                      at: p.granted_at,
                    })),
                  ].map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm truncate">{r.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {r.source} · {fmtDate(r.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={applyChanges} disabled={busy !== null}>
                {busy === "grant" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Salvar acessos
              </Button>
              <Button variant="outline" onClick={refresh} disabled={busy !== null || loading}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="destructive" onClick={revokeAll} disabled={busy !== null}>
                {busy === "revoke" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                Remover todos os acessos
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Marque para liberar e desmarque para remover — as alterações são aplicadas ao salvar.
              Produtos BST liberados sozinhos aplicam o mesmo modelo do checkout (aluno restrito à
              Biblioteca BST).
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}