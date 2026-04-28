import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

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
          {/* Google */}
          <Button variant="outline" className="w-full h-11 font-semibold" onClick={handleGoogleLogin} disabled={loading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Entrar com Google
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              ou
            </span>
          </div>

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
