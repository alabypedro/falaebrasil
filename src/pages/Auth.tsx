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

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // "Create password" mode — triggered when the user lands here from the
  // welcome email link (Hubla onboarding). The recovery link auto-signs the
  // user in and redirects to /auth?email=<email>.
  const [isCreatePassword, setIsCreatePassword] = useState(false);
  const [lockedUserId, setLockedUserId] = useState<string | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (!emailParam) return;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const sessionUser = data?.user;
      if (sessionUser?.email) {
        // Always trust the authenticated session email over the URL param
        setEmail(sessionUser.email);
        setLockedUserId(sessionUser.id);
        const meta = (sessionUser.user_metadata ?? {}) as Record<string, any>;
        setName(meta.full_name || meta.name || meta.display_name || "");
        setIsCreatePassword(true);
      } else {
        // No session yet — still pre-fill and lock the email so the student
        // sees their account being onboarded.
        setEmail(emailParam);
        setIsCreatePassword(true);
      }
    })();
  }, [searchParams]);

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(err.message || "Erro ao definir senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
        setIsForgot(false);
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  if (isCreatePassword) {
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
            <CardTitle className="text-2xl font-display font-extrabold">Crie sua senha</CardTitle>
            <CardDescription className="text-sm">
              Bem-vindo! Defina seu nome e senha para acessar a plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePassword} className="space-y-4">
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

  if (isForgot) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-hero p-4 page-transition overflow-hidden">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

        <Card className="w-full max-w-md glass-strong shadow-elegant border-border/40 relative z-10">
          <CardHeader className="text-center space-y-3">
            <img
              src={falaeLogo}
              alt="Falaê Brasil!"
              loading="eager"
              decoding="async"
              className="mx-auto block h-24 w-24 sm:h-20 sm:w-20 object-contain animate-float drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            />
            <CardTitle className="text-2xl font-display font-extrabold">Recuperar Senha</CardTitle>
            <CardDescription className="text-sm">
              Enviaremos um link de recuperação para seu email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-9 h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" variant="gradient" className="w-full h-11" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setIsForgot(false)}>
                Voltar ao login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-hero p-4 page-transition overflow-hidden">
      {/* Decorative animated blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-xp/20 blur-3xl animate-blob" style={{ animationDelay: "2s" }} />

      <Card className="w-full max-w-md glass-strong shadow-elegant border-border/40 relative z-10 animate-scale-in">
        <CardHeader className="text-center space-y-3">
          <img
            src={falaeLogo}
            alt="Falaê Brasil!"
            loading="eager"
            decoding="async"
            className="mx-auto block h-28 w-28 sm:h-24 sm:w-24 object-contain animate-float drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
          />
          <CardTitle className="text-2xl md:text-3xl font-display font-extrabold tracking-tight">
            {isSignUp ? "Criar Conta" : "Bem-vindo de volta"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isSignUp
              ? "Crie sua conta para começar a aprender."
              : "Acesse sua conta para continuar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
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
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-9 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {!isSignUp && (
                  <button
                    type="button"
                    className="text-xs font-medium text-accent hover:underline"
                    onClick={() => setIsForgot(true)}
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" variant="gradient" className="w-full h-11" disabled={loading}>
              {loading ? "Carregando..." : isSignUp ? "Criar Conta" : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Fazer login" : "Criar conta"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
