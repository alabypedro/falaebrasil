import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, UserPlus, Trash2, Link2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import CreateStudent from "@/pages/admin/CreateStudent";

interface Person {
  user_id: string;
  display_name: string | null;
  email: string | null;
  level?: string | null;
}

export default function TeachersManager() {
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState<Person | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: roleRows } = await supabase.from("user_roles").select("user_id").eq("role", "teacher" as any);
    const ids = ((roleRows as any[]) ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setTeachers([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", ids);
    setTeachers(
      (((profs as any[]) ?? []) as Person[]).sort((a, b) =>
        (a.display_name || a.email || "").localeCompare(b.display_name || b.email || "", "pt-BR"),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        (t.display_name ?? "").toLowerCase().includes(q) || (t.email ?? "").toLowerCase().includes(q),
    );
  }, [teachers, query]);

  const removeTeacherRole = async (t: Person) => {
    if (!confirm(`Remover o papel de professor de ${t.display_name || t.email}?`)) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", t.user_id)
      .eq("role", "teacher" as any);
    if (error) return toast.error(error.message);
    toast.success("Papel de professor removido.");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Professores</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Crie professores, gerencie o acesso deles e vincule os alunos que cada professor pode acompanhar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar professor..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Criar professor
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Criar professor</DialogTitle>
          </DialogHeader>
          <CreateStudent role="teacher" onCreated={load} />
        </DialogContent>
      </Dialog>

      {target && (
        <TeacherStudentsDialog
          teacher={target}
          open={!!target}
          onOpenChange={(v) => !v && setTarget(null)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhum professor cadastrado.
              </div>
            )}
            {filtered.map((t) => (
              <div key={t.user_id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {t.display_name || "(sem nome)"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{t.email || "—"}</div>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase border-0">
                  Professor
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setTarget(t)}>
                  <Link2 className="h-4 w-4 mr-1.5" /> Alunos deste professor
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeTeacherRole(t)}>
                  <ShieldOff className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeacherStudentsDialog({
  teacher,
  open,
  onOpenChange,
}: {
  teacher: Person;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [linked, setLinked] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: links } = await supabase
      .from("teacher_students")
      .select("student_id")
      .eq("teacher_id", teacher.user_id);
    const ids = ((links as any[]) ?? []).map((l) => l.student_id);
    if (ids.length === 0) {
      setLinked([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, email, level")
      .in("user_id", ids);
    setLinked((((profs as any[]) ?? []) as Person[]));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher.user_id]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, level")
        .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(20);
      setResults((((data as any[]) ?? []) as Person[]).filter((p) => p.user_id !== teacher.user_id));
      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [search, teacher.user_id]);

  const link = async (student: Person) => {
    const { error } = await supabase.from("teacher_students").insert({
      teacher_id: teacher.user_id,
      student_id: student.user_id,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Aluno vinculado.");
    setSearch("");
    setResults([]);
    load();
  };

  const unlink = async (student: Person) => {
    const { error } = await supabase
      .from("teacher_students")
      .delete()
      .eq("teacher_id", teacher.user_id)
      .eq("student_id", student.user_id);
    if (error) return toast.error(error.message);
    toast.success("Vínculo removido.");
    load();
  };

  const linkedIds = new Set(linked.map((l) => l.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Alunos deste professor — {teacher.display_name || teacher.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Vincular aluno</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="pl-9"
              />
            </div>
            {searching && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {results.length > 0 && (
              <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                {results.map((r) => (
                  <div key={r.user_id} className="flex items-center gap-2 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{r.display_name || "(sem nome)"}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={linkedIds.has(r.user_id)}
                      onClick={() => link(r)}
                    >
                      {linkedIds.has(r.user_id) ? "Vinculado" : "Vincular"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Alunos vinculados ({linked.length})
            </span>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : linked.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum aluno vinculado ainda.</p>
            ) : (
              <div className="rounded-md border divide-y">
                {linked.map((s) => (
                  <div key={s.user_id} className="flex items-center gap-2 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{s.display_name || "(sem nome)"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.email} {s.level ? `· ${s.level}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => unlink(s)} aria-label="Remover vínculo">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
