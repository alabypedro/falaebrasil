import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

export default function LinkPayment() {
  const [paymentId, setPaymentId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-link-payment", {
        body: { asaas_payment_id: paymentId.trim(), user_email: email.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data);
      toast.success("Pagamento vinculado com sucesso!");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao vincular pagamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Vincular pagamento ASAAS a um aluno
          </CardTitle>
          <CardDescription>
            Use quando o e-mail usado no checkout ASAAS for diferente do e-mail cadastrado
            na plataforma. Informe o ID do pagamento (ex.: <code>pay_xxxx</code>) e o e-mail
            do aluno que deve receber o acesso. Se o pagamento estiver pago, o acesso é
            liberado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pid">ID do pagamento ASAAS</Label>
              <Input
                id="pid"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="pay_xxxxxxxxxxxx"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail do aluno na plataforma</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aluno@exemplo.com"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Vinculando..." : "Vincular e liberar acesso"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}