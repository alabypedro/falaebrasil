import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildEvaluationPdf } from "@/lib/evaluationPdf";

export interface EmailResultPayload {
  toolLabel: string;
  overallScore?: number | null;
  metrics?: Array<{ label: string; value: number }>;
  transcription?: string;
  sections?: Array<{ title: string; lines: string[] }>;
}

interface Props extends EmailResultPayload {
  variant?: "button" | "icon";
  className?: string;
}

export default function EmailResultButton({ variant = "button", className, ...payload }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!user?.email) {
      toast({ title: "Não encontramos seu e-mail cadastrado.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const dateLabel = new Date().toLocaleDateString("pt-BR");

      // Gera o PDF da avaliação completa e guarda no armazenamento para anexar (via link) no e-mail
      let pdfUrl: string | undefined;
      try {
        const blob = buildEvaluationPdf({
          studentName: profile?.display_name ?? undefined,
          dateLabel,
          ...payload,
        });
        const path = `${user.id}/avaliacao-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("evaluation-reports")
          .upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from("evaluation-reports")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signErr) throw signErr;
        pdfUrl = signed?.signedUrl;
      } catch (pdfError) {
        console.error("Falha ao gerar/enviar o PDF da avaliação", pdfError);
      }

      const { error } = await supabase.functions.invoke("send-evaluation-report", {
        body: {
          templateData: {
            studentName: profile?.display_name ?? undefined,
            dateLabel,
            pdfUrl,
            idempotencyKey: `evaluation-report-${user.id}-${Date.now()}`,
            ...payload,
          },
        },
      });

      if (error) throw error;
      setSent(true);
      toast({
        title: "Avaliação enviada!",
        description: pdfUrl
          ? `Enviamos o resultado e o PDF da avaliação para ${user.email}.`
          : `Enviamos o resultado para ${user.email}.`,
      });
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      toast({ title: "Não foi possível enviar o e-mail", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className={cn("p-1 hover:text-primary transition-colors disabled:opacity-50", className)}
        title="Enviar avaliação por e-mail"
        aria-label="Enviar avaliação por e-mail"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : sent ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={sending}
      className={cn("h-8 gap-1.5 text-xs", className)}
      aria-label="Enviar avaliação por e-mail"
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : sent ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Mail className="h-3.5 w-3.5" />
      )}
      Enviar por e-mail
    </Button>
  );
}