import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, User } from "lucide-react";
import falaeLogo from "@/assets/falae-brasil-logo.png";

/**
 * Welcome / Create Account page.
 * Used for new students that purchased via Hubla. They arrive here through the
 * "welcome_purchase" email link (auto-signed-in by Supabase recovery token),
 * which carries ?email=<email>. They must set a name + password to activate
 * their account.
 */
export default function Welcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUserId, setLockedUserId] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    (async () => {
      const { data } = await supabase.auth.getUser();
      const sessionUser = data?.user;
      if (sessionUser?.email) {
        setEmail(sessionUser.email);
        setLockedUserId(sessionUser.id);
        setHasSession(true);
        const meta = (sessionUser.user_metadata ?? {}) as Record<string, any>;
        setName(meta.full_name || meta.name || meta.display_name || "");
      } else if (emailParam) {
        setEmail(emailParam);
        setHasSession(false);
      } else {
        // No session and no email → user shouldn't be here
        navigate("/auth", { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSession) {
      toast.error(
        "Seu link expirou. Reenvie o email de ativação clicando no botão abaixo."
      );
      return;
    }
    if (!name.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const trimmedName = name.trim();
      const { data: updated, error: updErr } = await supabase.auth.updateUser({
        password,
        data: {
          full_name: trimmedName,
          name: trimmedName,
          display_name: trimmedName,
        },
      });
      if (updErr) throw updErr;

      const userId = updated?.user?.id ?? lockedUserId;
      if (userId) {
        await supabase
          .from("profiles")
          .update({ display_name: trimmedName })
          .eq("user_id", userId);
      }

      toast.success("Conta ativada! Bem-vindo ao Falaê Brasil!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao ativar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/welcome?email=${encodeURIComponent(email)}`,
      });
      if (error) throw error;
      toast.success(
        "Enviamos um novo link de ativação para seu email. Use APENAS o email mais recente."
      );
    } catch (err: any) {
      toast.error(err.message || "Não foi possível reenviar o link.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-hero p-4 page-transition overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

      <Card className="w-full max-w-md glass-strong shadow-elegant border-border/40 relative z-10 animate-scale-in">
        <CardHeader className="text-center space-y-3">
          <img
            src={falaeLogo}
            alt="Falaê Brasil!"
            loading="eager"
            decoding="async"
            className="mx-auto block h-24 w-24 sm:h-20 sm:w-20 object-contain animate-float drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
          />
          <CardTitle className="text-2xl font-display font-extrabold">Crie sua conta</CardTitle>
          <CardDescription className="text-sm">
            Bem-vindo! Defina seu nome e senha para ativar seu acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession === false && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <p className="font-semibold text-destructive">Link expirado</p>
              <p className="mt-1 text-muted-foreground">
                Esse link de ativação não é mais válido (provavelmente você
                clicou em um email antigo). Clique abaixo para receber um novo
                link e use APENAS o email mais recente.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full"
                onClick={handleResend}
                disabled={resending || !email}
              >
                {resending ? "Enviando..." : "Reenviar link de ativação"}
              </Button>
            </div>
          )}
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Seu nome"
                  className="pl-9 h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
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
                  className="pl-9 h-11 bg-muted cursor-not-allowed"
                  value={email}
                  readOnly
                  disabled
                  tabIndex={-1}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                E-mail vinculado à sua compra (não editável).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Criar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="pl-9 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" variant="gradient" className="w-full h-11" disabled={loading}>
              {loading ? "Salvando..." : "Criar conta e entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
