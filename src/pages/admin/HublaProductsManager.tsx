import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, ExternalLink, Copy } from "lucide-react";

interface HublaProduct {
  id: string;
  product_key: string;
  display_name: string;
  hubla_product_id: string | null;
  hubla_product_name: string | null;
  checkout_url: string | null;
  price_cents: number;
  grants_course: boolean;
  grants_ebook1: boolean;
  grants_ebook2: boolean;
  grants_ebook3: boolean;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/hubla-webhook`;

export default function HublaProductsManager() {
  const [items, setItems] = useState<HublaProduct[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("hubla_product_mapping")
      .select("*")
      .order("price_cents", { ascending: false });
    if (error) { toast.error(error.message); return; }
    if (data) setItems(data as HublaProduct[]);
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: keyof HublaProduct, value: any) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const save = async (item: HublaProduct) => {
    setSavingId(item.id);
    const { error } = await supabase
      .from("hubla_product_mapping")
      .update({
        hubla_product_id: item.hubla_product_id?.trim() || null,
        hubla_product_name: item.hubla_product_name?.trim() || null,
        checkout_url: item.checkout_url?.trim() || null,
        price_cents: item.price_cents,
      })
      .eq("id", item.id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else toast.success(`${item.display_name} salvo!`);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL do webhook copiada!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Vendas Hubla</h2>
        <p className="text-sm text-muted-foreground">
          Configure os produtos do Hubla, URLs de checkout e visualize a URL do webhook.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook do Hubla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-xs">URL para configurar no painel da Hubla</Label>
          <div className="flex gap-2">
            <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyWebhook}><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole esta URL na Hubla. O secret <code>HUBLA_WEBHOOK_SECRET</code> já está configurado e será validado no header <code>X-Hubla-Token</code>.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{item.display_name}</span>
                <span className="text-xs font-mono text-muted-foreground">{item.product_key}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ID do produto na Hubla</Label>
                  <Input
                    value={item.hubla_product_id ?? ""}
                    onChange={(e) => updateField(item.id, "hubla_product_id", e.target.value)}
                    placeholder="ex: 12345"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do produto na Hubla</Label>
                  <Input
                    value={item.hubla_product_name ?? ""}
                    onChange={(e) => updateField(item.id, "hubla_product_name", e.target.value)}
                    placeholder="Nome exato do produto"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">URL de checkout do Hubla</Label>
                  <div className="flex gap-2">
                    <Input
                      value={item.checkout_url ?? ""}
                      onChange={(e) => updateField(item.id, "checkout_url", e.target.value)}
                      placeholder="https://pay.hub.la/..."
                    />
                    {item.checkout_url && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={item.checkout_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço (centavos)</Label>
                  <Input
                    type="number"
                    value={item.price_cents}
                    onChange={(e) => updateField(item.id, "price_cents", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">R$ {(item.price_cents / 100).toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs">Permissões liberadas por esta compra</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2"><Switch checked={item.grants_course} disabled /> Curso FB Básico PRO (A1)</div>
                  <div className="flex items-center gap-2"><Switch checked={item.grants_ebook1} disabled /> E-book 1</div>
                  <div className="flex items-center gap-2"><Switch checked={item.grants_ebook2} disabled /> E-book 2</div>
                  <div className="flex items-center gap-2"><Switch checked={item.grants_ebook3} disabled /> E-book 3</div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => save(item)} disabled={savingId === item.id} size="sm">
                  <Save className="h-4 w-4 mr-1.5" />
                  {savingId === item.id ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}