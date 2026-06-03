import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, User, Phone, Check, X, Eye, EyeOff, Sun, Moon } from "lucide-react";
import falaeLogo from "@/assets/falae-brasil-logo.png";
import { Helmet } from "react-helmet-async";
import { useTheme } from "@/contexts/ThemeContext";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = {
    length: password.length >= 8 && password.length <= 70,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneValid = phone.trim().length >= 8;
  const nameValid = name.trim().length > 0;
  const signUpValid = nameValid && phoneValid && emailValid && passwordValid;
  const signInValid = emailValid && password.length > 0;
  const forgotValid = emailValid;

  // Backwards-compat: old Hubla welcome emails redirected to /auth?email=<email>.
  // The new onboarding page lives at /welcome — forward any legacy link there
  // so existing emails in inboxes keep working.
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      navigate(`/welcome?email=${encodeURIComponent(emailParam)}`, { replace: true });
    }
  }, [searchParams, navigate]);

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
            data: { full_name: name, phone },
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Verifique seu email para confirmar.");
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setIsSignUp(false);
        }, 1500);
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação.");
    } finally {
      if (!success) setLoading(false);
    }
  };

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
              <Button type="submit" variant="gradient" className="w-full h-11" disabled={loading || !forgotValid}>
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
      <Helmet>
        <title>{isSignUp ? "Criar conta — Falaê Brasil" : isForgot ? "Recuperar senha — Falaê Brasil" : "Entrar — Falaê Brasil"}</title>
        <meta name="description" content={isSignUp
          ? "Crie sua conta no Falaê Brasil e comece a praticar inglês com IA, quizzes e laboratórios de pronúncia, escrita e escuta."
          : isForgot
          ? "Recupere o acesso à sua conta Falaê Brasil para voltar a praticar inglês com nossos laboratórios de IA."
          : "Entre na sua conta Falaê Brasil e continue praticando inglês com IA, gamificação e trilhas do A1 ao B2."} />
        <meta property="og:title" content={isSignUp ? "Criar conta — Falaê Brasil" : "Entrar — Falaê Brasil"} />
        <meta property="og:description" content={isSignUp
          ? "Cadastre-se gratuitamente e comece a praticar inglês com IA."
          : "Acesse sua conta e continue aprendendo inglês com IA."} />
        <meta property="og:url" content="https://app.falaebrasil.com.br/auth" />
        <link rel="canonical" href="https://app.falaebrasil.com.br/auth" />
      </Helmet>
      <h1 className="sr-only">{isSignUp ? "Criar conta no Falaê Brasil" : "Entrar no Falaê Brasil"}</h1>
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

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    className="pl-9 h-11"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className={`absolute left-3 top-3 h-4 w-4 ${emailValid ? "text-emerald-500" : "text-muted-foreground"}`} />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className={`pl-9 pr-9 h-11 ${emailValid ? "border-emerald-500/60 focus-visible:ring-emerald-500/40" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {emailValid && (
                  <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-500" />
                )}
              </div>
              {isSignUp && email.length > 0 && !emailValid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" /> Precisamos de um e-mail válido
                </p>
              )}
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
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignUp ? 8 : 6}
                  maxLength={isSignUp ? 70 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isSignUp && (
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
              )}
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-11"
              disabled={loading || success || (isSignUp ? !signUpValid : !signInValid)}
            >
              {success
                ? "Conta criada!"
                : loading
                ? "Carregando..."
                : isSignUp
                ? "Criar Conta"
                : "Entrar"}
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
