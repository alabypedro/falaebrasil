import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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

interface CourseRow {
  id: string;
  title: string;
  level: string;
  required_tier: string;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/hubla-webhook`;

export default function HublaProductsManager() {
  const [items, setItems] = useState<HublaProduct[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  // map<product_mapping_id, Set<course_id>>
  const [productCourses, setProductCourses] = useState<Record<string, Set<string>>>({});

  const load = async () => {
    const [{ data, error }, { data: courseData }, { data: linkData }] = await Promise.all([
      supabase
      .from("hubla_product_mapping")
      .select("*")
      .order("price_cents", { ascending: false }),
      supabase
        .from("courses")
        .select("id, title, level, required_tier")
        .eq("published", true)
        .order("display_order"),
      supabase
        .from("hubla_product_courses")
        .select("product_mapping_id, course_id"),
    ]);
    if (error) { toast.error(error.message); return; }
    if (data) setItems((data as HublaProduct[]).filter((p) => p.product_key !== "plano_pro" && p.product_key !== "plano_vip"));
    if (courseData) setCourses(courseData as CourseRow[]);
    if (linkData) {
      const map: Record<string, Set<string>> = {};
      for (const row of linkData as any[]) {
        if (!map[row.product_mapping_id]) map[row.product_mapping_id] = new Set();
        map[row.product_mapping_id].add(row.course_id);
      }
      setProductCourses(map);
    }
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: keyof HublaProduct, value: any) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const toggleCourse = (productId: string, courseId: string, checked: boolean) => {
    setProductCourses((prev) => {
      const next = { ...prev };
      const set = new Set(next[productId] ?? []);
      if (checked) set.add(courseId); else set.delete(courseId);
      next[productId] = set;
      return next;
    });
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
    if (error) { setSavingId(null); toast.error(error.message); return; }

    // Sync hubla_product_courses: delete-all + re-insert is simplest
    const selected = Array.from(productCourses[item.id] ?? []);
    const { error: delErr } = await supabase
      .from("hubla_product_courses")
      .delete()
      .eq("product_mapping_id", item.id);
    if (delErr) { setSavingId(null); toast.error(delErr.message); return; }
    if (selected.length > 0) {
      const rows = selected.map((cid) => ({ product_mapping_id: item.id, course_id: cid }));
      const { error: insErr } = await supabase.from("hubla_product_courses").insert(rows);
      if (insErr) { setSavingId(null); toast.error(insErr.message); return; }
    }
    setSavingId(null);
    toast.success(`${item.display_name} salvo!`);
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

              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs">
                  Cursos liberados ao comprar este produto
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Marque todos os cursos que devem ser desbloqueados automaticamente
                  para o aluno quando ele finalizar esta compra na Hubla.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {courses.map((c) => {
                    const checked = productCourses[item.id]?.has(c.id) ?? false;
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm rounded-md border border-border/50 px-2 py-1.5 cursor-pointer hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleCourse(item.id, c.id, !!v)}
                        />
                        <span className="flex-1">{c.title}</span>
                        <span className="text-[10px] uppercase text-muted-foreground font-mono">
                          {c.level} · {c.required_tier}
                        </span>
                      </label>
                    );
                  })}
                  {courses.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum curso publicado.</p>
                  )}
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