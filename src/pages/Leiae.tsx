import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookText, Sparkles, Languages, Volume2, Image as ImageIcon } from "lucide-react";
import { useLeiae } from "@/hooks/useLeiae";
import { toast } from "sonner";

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Relatório de auditoria",
    text:
      "The internal audit review identified material weaknesses in the reconciliation of intercompany balances. Management is required to remediate the deficiencies and implement compensating controls before the next reporting cycle.",
  },
  {
    label: "E-mail da matriz",
    text:
      "Dear Team,\n\nPlease be advised that the headquarters has approved the revised shipment schedule. Kindly forward the updated bill of lading and ensure customs clearance is expedited to avoid demurrage charges.\n\nBest regards.",
  },
  {
    label: "Guia de embarque",
    text:
      "Shipper must attach the commercial invoice, packing list and certificate of origin. Hazardous materials require an MSDS and dangerous goods declaration. All freight is subject to inspection by customs authorities.",
  },
];

export default function Leiae() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const { open, loading } = useLeiae("pt-BR");

  const handleOpen = () => {
    const content = text.trim();
    if (!content) {
      toast.info("Cole ou digite um texto para a IA Leiaê ler com você.");
      return;
    }
    open([
      {
        title: title.trim() || "Leitura interativa",
        content,
        lang: "en",
        mimeType: "text/plain",
      },
    ]);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">IA Leiaê</h1>
          <Badge className="bg-primary/15 text-primary border-0">Leitura Técnica Interativa</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Decifre relatórios de auditoria, e-mails da matriz e guias de embarque de forma independente.
          Clique em qualquer palavra para ver tradução, sílabas, imagem e áudio.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { icon: Languages, label: "Tradução PT-BR instantânea" },
          { icon: Volume2, label: "Áudio palavra por palavra" },
          { icon: BookText, label: "Divisão silábica" },
          { icon: ImageIcon, label: "Imagens de suporte" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground"
          >
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seu texto em inglês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional) — ex.: Auditoria Q3"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o relatório, e-mail ou guia em inglês…"
            className="min-h-[220px] font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setTitle(s.label);
                  setText(s.text);
                }}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleOpen} disabled={loading} size="lg">
              <BookText className="h-4 w-4 mr-2" />
              {loading ? "Abrindo IA Leiaê…" : "Abrir IA Leiaê"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}