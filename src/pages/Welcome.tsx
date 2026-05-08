import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, User, Check, X } from "lucide-react";
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
  const [success, setSuccess] = useState(false);

  const passwordChecks = {
    length: password.length >= 8 && password.length <= 70,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const formValid = name.trim().length > 0 && passwordValid;

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
    if (!formValid) return;
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
      setSuccess(true);
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err: any) {
      toast.error(err.message || "Erro ao ativar conta.");
      setLoading(false);
      return;
    }
    // keep loading=true on success so the button stays disabled until redirect
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
                <Mail className="absolute left-3 top-3 h-4 w-4 text-emerald-500" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9 pr-9 h-11 bg-muted cursor-not-allowed border-emerald-500/60 focus-visible:ring-emerald-500/40"
                  value={email}
                  readOnly
                  disabled
                  tabIndex={-1}
                />
                <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-500" />
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
                  placeholder="Crie uma senha segura"
                  className="pl-9 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={70}
                />
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {[
                  { ok: passwordChecks.length, label: "De 8 a 70 caracteres" },
                  { ok: passwordChecks.lower, label: "Letra minúscula" },
                  { ok: passwordChecks.upper, label: "Letra maiúscula" },
                  { ok: passwordChecks.number, label: "Número" },
                  { ok: passwordChecks.symbol, label: "Símbolo (Ex: !@#$%)" },
                ].map((r) => (
                  <li key={r.label} className="flex items-center gap-2">
                    {r.ok ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className={r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                      {r.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-11"
              disabled={loading || success || !formValid || !hasSession}
            >
              {success ? "Conta criada!" : loading ? "Salvando..." : "Criar Conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
