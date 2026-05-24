import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Download } from "lucide-react";

interface Contract {
  id: string;
  tier: string;
  title: string;
  file_path: string | null;
  file_name: string | null;
}

const ORDER = ["open", "pro", "vip", "teens", "kids"];

export default function ContractsManager() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("contracts").select("*");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const sorted = (data ?? []).sort(
        (a: any, b: any) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier)
      );
      setContracts(sorted as Contract[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (c: Contract, file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "Arquivo inválido", description: "Envie apenas arquivos PDF.", variant: "destructive" });
      return;
    }
    setBusyId(c.id);
    const path = `${c.tier}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("contracts")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      setBusyId(null);
      toast({ title: "Erro ao enviar", description: upErr.message, variant: "destructive" });
      return;
    }
    // remove old file if exists
    if (c.file_path) {
      await supabase.storage.from("contracts").remove([c.file_path]);
    }
    const { error: updErr } = await supabase
      .from("contracts")
      .update({ file_path: path, file_name: file.name })
      .eq("id", c.id);
    setBusyId(null);
    if (updErr) {
      toast({ title: "Erro ao salvar", description: updErr.message, variant: "destructive" });
    } else {
      toast({ title: "Contrato enviado", description: c.title });
      load();
    }
  };

  const remove = async (c: Contract) => {
    if (!c.file_path) return;
    if (!confirm(`Remover o arquivo de "${c.title}"?`)) return;
    setBusyId(c.id);
    await supabase.storage.from("contracts").remove([c.file_path]);
    const { error } = await supabase
      .from("contracts")
      .update({ file_path: null, file_name: null })
      .eq("id", c.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Arquivo removido" });
      load();
    }
  };

  const openContract = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao abrir", description: error?.message ?? "URL inválida", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contratos modelo</CardTitle>
          <CardDescription>
            Envie um arquivo PDF para cada hierarquia de plano. Todos os usuários autenticados poderão visualizar e baixar.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{c.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.file_path ? (
                  <div className="flex items-center justify-between gap-2 text-sm rounded-md border border-border bg-muted/30 px-3 py-2">
                    <span className="truncate">{c.file_name}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openContract(c.file_path!)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(c)}
                        disabled={busyId === c.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum arquivo enviado.</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`file-${c.id}`} className="text-xs">
                    {c.file_path ? "Substituir arquivo (PDF)" : "Enviar arquivo (PDF)"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`file-${c.id}`}
                      type="file"
                      accept="application/pdf"
                      disabled={busyId === c.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(c, f);
                        e.target.value = "";
                      }}
                    />
                    {busyId === c.id && (
                      <Upload className="h-4 w-4 animate-pulse text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}