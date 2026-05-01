import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, User } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setEmail(data.user.email ?? "");
        setUserId(data.user.id);
        const meta = data.user.user_metadata || {};
        const existingName =
          meta.full_name || meta.name || meta.display_name || "";
        if (existingName) setName(existingName);
      }
    };
    loadUser();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    setLoading(true);
    try {
      const trimmedName = name.trim();

      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { full_name: trimmedName, name: trimmedName, display_name: trimmedName },
      });
      if (updateErr) throw updateErr;

      if (userId) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ display_name: trimmedName })
          .eq("user_id", userId);
        if (profileErr) console.error("Profile update error:", profileErr);
      }

      toast.success("Conta configurada com sucesso!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bem-vindo(a)! Crie sua conta</CardTitle>
          <CardDescription>
            Confirme seu nome e defina uma senha para acessar a plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  className="pl-9"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9 bg-muted/50 cursor-not-allowed"
                  value={email}
                  readOnly
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Criar Conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
