import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, FileX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();

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

  const openContract = async (contractId: string) => {
    const { data, error } = await supabase.functions.invoke("contract-signed-url", {
      body: { contractId },
    });
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("contracts.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("contracts.subtitle")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("contracts.loading")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{`${t("contracts.modelPrefix")} ${(c.tier || "").toUpperCase()}`}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {c.file_path ? (
                  <Button className="w-full" onClick={() => openContract(c.file_path!)}>
                    <Download className="h-4 w-4 mr-1.5" />
                    {t("contracts.open")}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <FileX className="h-4 w-4" />
                    {t("contracts.notAvailable")}
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