import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, FileX } from "lucide-react";

interface Contract {
  id: string;
  tier: string;
  title: string;
  file_path: string | null;
  file_name: string | null;
}

const ORDER = ["open", "pro", "vip", "teens", "kids"];

export default function Contratos() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("contracts").select("*");
      const sorted = (data ?? []).sort(
        (a: any, b: any) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier)
      );
      setContracts(sorted as Contract[]);
      setLoading(false);
    })();
  }, []);

  const getUrl = (path: string) =>
    supabase.storage.from("contracts").getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize e baixe os contratos modelo de cada hierarquia de plano.
        </p>
      </div>

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
              <CardContent>
                {c.file_path ? (
                  <Button asChild className="w-full">
                    <a
                      href={getUrl(c.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Baixar PDF
                    </a>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <FileX className="h-4 w-4" />
                    Contrato ainda não disponível.
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}