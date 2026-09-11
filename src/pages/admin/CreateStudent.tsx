import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { LEVELS } from "@/lib/levels";

const TIERS = ["open", "pro", "vip", "kids", "teens", "bst"] as const;

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

const LEVEL_GROUPS = [
  { key: "adults", title: "Níveis Adultos", levels: ["A1", "A2", "B1", "B2", "C1", "C2"] },
  { key: "teens", title: "Níveis Teens", levels: ["T1", "T2", "T3", "T4"] },
  { key: "kids", title: "Níveis Kids", levels: ["K1", "K2", "K3", "K4"] },
] as const;

const GROUPS = [
  { key: "adults", title: "Cursos Adultos (A1 → C2)", tiers: ["open", "pro", "vip"] },
  { key: "teens", title: "Cursos Teens 1 ao 4", tiers: ["teens"] },
  { key: "kids", title: "Cursos Kids 1 ao 4", tiers: ["kids"] },
] as const;

function genPwd(): string {
  const upp = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const low = "abcdefghijkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*";
  const pool = upp + low + num + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let p = pick(upp) + pick(low) + pick(num) + pick(sym);
  for (let i = 0; i < 8; i++) p += pick(pool);
  return p.split("").sort(() => Math.random() - 0.5).join("");
}

export default function CreateStudent({
  onCreated,
  role = "student",
}: { onCreated?: () => void; role?: "student" | "teacher" } = {}) {
  const isTeacher = role === "teacher";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(genPwd());
  const [showPwd, setShowPwd] = useState(true);
  const [tier, setTier] = useState<string>("open");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [bstProducts, setBstProducts] = useState<BstRow[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Record<string, boolean>>({});
  const [selectedBst, setSelectedBst] = useState<Record<string, boolean>>({});
  const [musicLab, setMusicLab] = useState(true);
  const [booksAccess, setBooksAccess] = useState(true);
  const [levels, setLevels] = useState<string[]>([...LEVELS]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string; created: boolean } | null>(null);

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

  const toggleLevel = (lv: string) =>
    setLevels((s) => (s.includes(lv) ? s.filter((x) => x !== lv) : [...s, lv]));
  const setGroupLevels = (group: readonly string[], value: boolean) =>
    setLevels((s) =>
      value ? Array.from(new Set([...s, ...group])) : s.filter((x) => !group.includes(x)),
    );

  const toggleCourse = (id: string) => setSelectedCourses((s) => ({ ...s, [id]: !s[id] }));
  const toggleBst = (id: string) => setSelectedBst((s) => ({ ...s, [id]: !s[id] }));
  const selectAllCourses = (ids: string[], value: boolean) =>
    setSelectedCourses((s) => {
      const next = { ...s };
      ids.forEach((id) => (next[id] = value));
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const courseIds = Object.keys(selectedCourses).filter((k) => selectedCourses[k]);
      const bstIds = Object.keys(selectedBst).filter((k) => selectedBst[k]);
      const { data, error } = await supabase.functions.invoke("create-student-admin", {
        body: {
          email: email.trim().toLowerCase(),
          display_name: name.trim(),
          password,
          accesses: [],
          course_ids: courseIds,
          bst_product_ids: bstIds,
          plan_tier: tier,
          role,
          music_lab: musicLab,
          books_access: booksAccess,
          allowed_levels: levels.length === LEVELS.length ? [] : levels,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({ email: data.email, password: data.password, created: data.created });
      toast.success(
        data.created
          ? isTeacher ? "Professor criado!" : "Aluno criado!"
          : isTeacher ? "Professor atualizado com nova senha!" : "Aluno atualizado com nova senha!",
      );
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar aluno.");
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    const text = `Acesso ao Falaê Brasil\nSite: https://app.falaebrasil.com.br\nEmail: ${result.email}\nSenha temporária: ${result.password}`;
    navigator.clipboard.writeText(text);
    toast.success("Credenciais copiadas!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {isTeacher ? "Criar Professor com Senha Temporária" : "Criar Aluno com Senha Temporária"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Cria a conta já ativada (sem precisar confirmar email) e libera os acessos escolhidos.
          {isTeacher
            ? " O professor faz o 1º login com email + senha temporária e recebe automaticamente o papel de professor."
            : " O aluno faz o 1º login com email + senha temporária."}
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Cadastro manual
          </CardTitle>
          <CardDescription>
            Se o email já existir, a senha será redefinida e os acessos aplicados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="aluno@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder={isTeacher ? "Nome do professor" : "Nome do aluno"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pwd">Senha temporária</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="pwd"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-2 text-muted-foreground"
                    aria-label="Mostrar/ocultar"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={() => setPassword(genPwd())}>
                  <RefreshCw className="h-4 w-4" /> Gerar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <div className="flex flex-wrap gap-2">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      tier === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Acessos a liberar</Label>

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
                        onClick={() => selectAllCourses(g.items.map((i) => i.id), true)}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => selectAllCourses(g.items.map((i) => i.id), false)}
                      >
                        Nenhum
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {g.items.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted"
                      >
                        <Checkbox
                          checked={!!selectedCourses[c.id]}
                          onCheckedChange={() => toggleCourse(c.id)}
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
                    Bibliotecaê BST
                  </span>
                  <div className="grid gap-2">
                    {bstProducts.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted"
                      >
                        <Checkbox
                          checked={!!selectedBst[p.id]}
                          onCheckedChange={() => toggleBst(p.id)}
                        />
                        <span className="text-sm">{p.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Conteúdos extras</Label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted">
                  <Checkbox checked={musicLab} onCheckedChange={() => setMusicLab((v) => !v)} />
                  <span className="text-sm">Cantaê (Music Lab)</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted">
                  <Checkbox checked={booksAccess} onCheckedChange={() => setBooksAccess((v) => !v)} />
                  <span className="text-sm">Estórias Curtas (A1 até C2)</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Níveis liberados</Label>
                <p className="text-xs text-muted-foreground">
                  Somente os níveis selecionados aparecerão para o aluno nas IAs, Cantaê e Estórias
                  Curtas. Selecionar todos mantém o acesso completo.
                </p>
              </div>
              {LEVEL_GROUPS.map((g) => (
                <div key={g.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {g.title}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setGroupLevels(g.levels, true)}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => setGroupLevels(g.levels, false)}
                      >
                        Nenhum
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.levels.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => toggleLevel(lv)}
                        className={`w-11 h-9 rounded-full text-xs font-bold border ${
                          levels.includes(lv)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {levels.length === 0 && (
                <p className="text-xs text-destructive">
                  Nenhum nível selecionado: o aluno não verá conteúdo por nível.
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading || !email.trim() || password.length < 8}>
              <UserPlus className="h-4 w-4" />
              {loading
                ? "Criando..."
                : isTeacher
                  ? "Criar professor e liberar acesso"
                  : "Criar aluno e liberar acesso"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="max-w-2xl border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">
              {result.created ? "Conta criada com sucesso" : "Senha redefinida"}
            </CardTitle>
            <CardDescription>
              Envie estas credenciais ao aluno. Ele pode fazer login direto em{" "}
              <span className="font-mono">app.falaebrasil.com.br</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-3 font-mono text-sm space-y-1">
              <div>Email: {result.email}</div>
              <div>Senha: {result.password}</div>
            </div>
            <Button variant="outline" onClick={copyCredentials}>
              <Copy className="h-4 w-4" /> Copiar credenciais
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}