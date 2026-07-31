import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";

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

export default function CreateStudent() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(genPwd());
  const [showPwd, setShowPwd] = useState(true);
  const [tier, setTier] = useState<string>("open");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [bstProducts, setBstProducts] = useState<BstRow[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Record<string, boolean>>({});
  const [selectedBst, setSelectedBst] = useState<Record<string, boolean>>({});
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
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({ email: data.email, password: data.password, created: data.created });
      toast.success(data.created ? "Aluno criado!" : "Aluno atualizado com nova senha!");
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
        <h2 className="text-lg font-semibold">Criar Aluno com Senha Temporária</h2>
        <p className="text-sm text-muted-foreground">
          Cria a conta já ativada (sem precisar confirmar email) e libera os acessos escolhidos.
          O aluno faz o 1º login com email + senha temporária.
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
                  placeholder="Nome do aluno"
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

            <div className="space-y-2">
              <Label>Acessos a liberar</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {ACCESSES.map((a) => (
                  <label
                    key={a.key}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted"
                  >
                    <Checkbox
                      checked={!!accesses[a.key]}
                      onCheckedChange={() => toggle(a.key)}
                    />
                    <span className="text-sm">{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={loading || !email.trim() || password.length < 8}>
              <UserPlus className="h-4 w-4" />
              {loading ? "Criando..." : "Criar aluno e liberar acesso"}
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