import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

export default function WelcomeEmailSender() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-welcome-email-admin", {
        body: { email: trimmed },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Email de boas-vindas enviado para ${trimmed}`);
      setEmail("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Reenviar Email de Boas-vindas</h2>
        <p className="text-sm text-muted-foreground">
          Envie manualmente o email de boas-vindas (criação de senha) para um aluno
          que já está cadastrado mas não recebeu ou perdeu o email original.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Envio manual
          </CardTitle>
          <CardDescription>
            O aluno precisa já existir no banco de dados (compra Hubla processada).
            O link mais recente invalida os anteriores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do aluno</Label>
              <Input
                id="email"
                type="email"
                placeholder="aluno@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim()}>
              <Send className="h-4 w-4" />
              {loading ? "Enviando..." : "Enviar email de boas-vindas"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}