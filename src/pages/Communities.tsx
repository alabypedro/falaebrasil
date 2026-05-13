import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageCircle, Lock, ExternalLink, GraduationCap, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";

type Tier = "open" | "pro" | "vip" | "kids" | "teens";

interface Community {
  id: string;
  title: string;
  description: string | null;
  whatsapp_url: string | null;
  access_key: string;
  required_tier: Tier;
  all_tiers: boolean;
  sort_order: number;
}

// OPEN/PRO/VIP têm hierarquia. KIDS e TEENS são isolados (rank 0) — sem upsell entre eles.
const tierRank = (t?: string | null) =>
  t === "vip" ? 3 : t === "pro" ? 2 : t === "open" ? 1 : 0;
const isHierarchical = (t?: string | null) => t === "open" || t === "pro" || t === "vip";

export default function Communities() {
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Community | null>(null);
  const [upsellTier, setUpsellTier] = useState<"pro" | "vip" | null>(null);
  const [proCheckoutUrl, setProCheckoutUrl] = useState<string | null>(null);
  const [vipCheckoutUrl, setVipCheckoutUrl] = useState<string | null>(null);
  const [teacherUrl, setTeacherUrl] = useState<string | null>(null);
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  const userTier: Tier = isAdmin ? "vip" : ((profile?.plan_tier as Tier) ?? "open");

  useEffect(() => {
    (async () => {
      const [communitiesRes, teacherRes, mappingRes] = await Promise.all([
        supabase.from("fb_communities").select("*").order("sort_order", { ascending: true }),
        supabase.from("vip_config").select("teacher_chat_url").eq("id", 1).maybeSingle(),
        supabase.from("hubla_product_mapping").select("product_key, checkout_url").in("product_key", ["plano_pro", "plano_vip"]),
      ]);
      if (communitiesRes.data) setItems(communitiesRes.data as Community[]);
      setTeacherUrl(teacherRes.data?.teacher_chat_url ?? null);
      const mapping = mappingRes.data ?? [];
      setProCheckoutUrl(mapping.find((m: any) => m.product_key === "plano_pro")?.checkout_url ?? null);
      setVipCheckoutUrl(mapping.find((m: any) => m.product_key === "plano_vip")?.checkout_url ?? null);
      setLoading(false);
    })();
  }, []);

  // Acesso exato ao tier: VIP não entra em grupos OPEN/PRO; PRO não entra em OPEN.
  // Admin mantém acesso total. Grupos com all_tiers=true liberam para todos.
  const hasAccess = (item: Community) =>
    isAdmin || item.all_tiers || userTier === (item.required_tier ?? "open");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const upsellCheckoutUrl = upsellTier === "vip" ? vipCheckoutUrl : proCheckoutUrl;

  return (
    <div className="space-y-6 max-w-6xl page-transition">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunidades FB</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acesse os grupos de WhatsApp dos alunos Falaê Brasil!
        </p>
      </div>

      {/* === Card VIP: Aula particular com o professor === */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Aula particular com o professor</h3>
              <Badge variant="default" className="text-[10px] gap-1"><Crown className="h-3 w-3" /> VIP</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chat direto 1:1 com o professor. Disponível apenas para alunos VIP.
            </p>
          </div>
          {userTier === "vip" && teacherUrl ? (
            <Button asChild>
              <a href={teacherUrl} target="_blank" rel="noopener noreferrer">
                Conversar agora <ExternalLink className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          ) : userTier === "vip" ? (
            <Button disabled>Link em breve</Button>
          ) : (
            <Button onClick={() => setUpsellTier("vip")}>
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear VIP
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const required = item.required_tier ?? "open";
          const locked = !hasAccess(item);
          // Aluno com plano inferior vendo grupo de plano superior → popup de upgrade
          // Aluno com plano superior vendo grupo de plano inferior → trancado SEM popup
          // Popup de upsell só quando o usuário tem plano INFERIOR ao requerido,
          // e apenas dentro da hierarquia OPEN→PRO→VIP. KIDS/TEENS são isolados.
          const showUpsell =
            locked &&
            isHierarchical(userTier) &&
            isHierarchical(required) &&
            tierRank(userTier) < tierRank(required);
          return (
            <Card key={item.id} className={`hover:shadow-md transition-shadow ${locked ? "opacity-90" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <span className={`text-4xl ${locked ? "grayscale" : ""}`}>💬</span>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={required === "pro" ? "default" : "secondary"} className="text-[10px] border-0 uppercase">
                      {required}
                    </Badge>
                    {locked && (
                      <Badge variant="secondary" className="text-[10px] border-0 gap-1">
                        <Lock className="h-3 w-3" /> Bloqueado
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                </div>
                {locked && showUpsell ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => setUpsellTier("pro")}
                  >
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear PRO
                  </Button>
                ) : locked && showUpsell ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => setUpsellTier(required as "pro" | "vip")}
                  >
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear {String(required).toUpperCase()}
                  </Button>
                ) : locked ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Bloqueado
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelected(item)}
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Grupo de WhatsApp
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8 col-span-full">
            Nenhuma comunidade disponível.
          </p>
        )}
      </div>

      {/* Modal de acesso ao grupo */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">{selected?.title}</DialogTitle>
            <DialogDescription className="text-center">
              {selected?.description ?? "Grupo de WhatsApp da comunidade."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="min-w-0 sm:flex-col sm:space-x-0 gap-2">
            {selected?.whatsapp_url ? (
              <Button asChild className="w-full max-w-full">
                <a
                  href={selected.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Entrar no grupo <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button disabled className="w-full">Link em breve</Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de upsell de plano */}
      <Dialog open={!!upsellTier} onOpenChange={(o) => !o && setUpsellTier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              {upsellTier === "vip" ? <Crown className="h-6 w-6 text-primary" /> : <Lock className="h-6 w-6 text-primary" />}
            </div>
            <DialogTitle className="text-center">
              {upsellTier === "vip" ? "Plano VIP" : "Plano PRO"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {upsellTier === "vip"
                ? "Tenha aulas particulares com o professor (chat 1:1) além de tudo do plano PRO."
                : "Desbloqueie acesso aos grupos de WhatsApp por nível (A1, A2, B1, B2)."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
            {upsellCheckoutUrl ? (
              <Button asChild className="w-full">
                <a href={upsellCheckoutUrl} target="_blank" rel="noopener noreferrer">
                  Comprar agora <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button disabled className="w-full">Checkout em breve</Button>
            )}
            <Button variant="outline" onClick={() => setUpsellTier(null)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
