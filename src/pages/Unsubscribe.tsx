import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "already" | "invalid" | "done";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        const data = await res.json();
        if (data?.valid) setState("valid");
        else if (data?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setSubmitting(false);
    if (!error && (data?.success || data?.reason === "already_unsubscribed")) setState("done");
    else setState("invalid");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="items-center text-center">
          <div className="mb-2 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {state === "done" ? <Check className="h-5 w-5 text-success" /> : <MailX className="h-5 w-5 text-muted-foreground" />}
          </div>
          <CardTitle className="text-lg">Cancelar inscrição de e-mails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state === "loading" && <Loader2 className="h-6 w-6 animate-spin mx-auto" />}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                Confirme abaixo para deixar de receber nossos e-mails.
              </p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar cancelamento
              </Button>
            </>
          )}
          {state === "already" && (
            <p className="text-sm text-muted-foreground">
              Este e-mail já estava cancelado. Você não receberá mais nossas mensagens.
            </p>
          )}
          {state === "done" && (
            <p className="text-sm text-muted-foreground">
              Inscrição cancelada com sucesso. Sentiremos sua falta!
            </p>
          )}
          {state === "invalid" && (
            <p className="text-sm text-muted-foreground">
              Link inválido ou expirado. Se precisar de ajuda, escreva para atendimento@falaebrasil.com.br.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}