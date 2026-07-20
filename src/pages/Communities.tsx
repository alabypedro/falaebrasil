import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageCircle, Lock, ExternalLink, GraduationCap, Crown, Folder, FolderOpen, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { UpsellModal } from "@/components/UpsellModal";

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

const TIER_LABELS: Record<Tier, string> = {
  kids: "Aluno KIDS (8 - 12 anos)",
  teens: "Aluno TEENS (13 - 17 anos)",
  open: "Aluno OPEN (18+)",
  pro: "Aluno PRO (18+)",
  vip: "Aluno VIP (18+)",
};
const TIER_ORDER: Tier[] = [];

function SubfolderRow({
  item,
  isOpen,
  onToggle,
  onJoin,
}: {
  item: Community;
  isOpen: boolean;
  onToggle: () => void;
  onJoin: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
        {isOpen ? (
          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-primary shrink-0" />
        )}
        <span className="text-sm text-foreground truncate">{item.title}</span>
      </button>
      {isOpen && (
        <div className="ml-7 pl-3 py-2 border-l border-border space-y-2">
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}
          {item.whatsapp_url ? (
            <Button size="sm" variant="outline" onClick={onJoin}>
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Entrar no grupo
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Link em breve
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Communities() {
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Community | null>(null);
  const [upsellTier, setUpsellTier] = useState<"pro" | "vip" | null>(null);
  const [proCheckoutUrl, setProCheckoutUrl] = useState<string | null>(null);
  const [vipCheckoutUrl, setVipCheckoutUrl] = useState<string | null>(null);
  const [teacherUrl, setTeacherUrl] = useState<string | null>(null);
  const [paidChatUrl, setPaidChatUrl] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();

  const userTier: Tier = isAdmin ? "vip" : ((profile?.plan_tier as Tier) ?? "open");

  useEffect(() => {
    (async () => {
      const [communitiesRes, teacherRes, mappingRes] = await Promise.all([
        supabase.from("fb_communities").select("*").order("sort_order", { ascending: true }),
        supabase.from("vip_config").select("teacher_chat_url, paid_chat_url").eq("id", 1).maybeSingle(),
        supabase.from("hubla_product_mapping").select("product_key, checkout_url").in("product_key", ["plano_pro", "plano_vip"]),
      ]);
      if (communitiesRes.data) setItems(communitiesRes.data as Community[]);
      setTeacherUrl(teacherRes.data?.teacher_chat_url ?? null);
      setPaidChatUrl((teacherRes.data as any)?.paid_chat_url ?? null);
      const mapping = mappingRes.data ?? [];
      setProCheckoutUrl(mapping.find((m: any) => m.product_key === "plano_pro")?.checkout_url ?? null);
      setVipCheckoutUrl(mapping.find((m: any) => m.product_key === "plano_vip")?.checkout_url ?? null);
      setLoading(false);
    })();
  }, []);

  // Acesso exato ao tier: VIP não entra em grupos OPEN/PRO; PRO não entra em OPEN.
  // Admin mantém acesso total. Grupos com all_tiers=true liberam para todos.
  const hasAccess = (item: Community) => {
    if (isAdmin || item.all_tiers) return true;
    
    // OPEN tier has access to all groups marked as 'open'
    if (userTier === "open" && item.required_tier === "open") return true;
    
    return userTier === (item.required_tier ?? "open");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const upsellCheckoutUrl = upsellTier === "vip" ? vipCheckoutUrl : proCheckoutUrl;

  const generalItems = items.filter((i) => i.all_tiers);
  const groupedByTier: Record<Tier, Community[]> = {
    kids: [], teens: [], open: [], pro: [], vip: [],
  };
  items.filter((i) => !i.all_tiers).forEach((i) => {
    const t = (i.required_tier ?? "open") as Tier;
    groupedByTier[t].push(i);
  });

  const toggleFolder = (key: string) => setOpenFolders((p) => ({ ...p, [key]: !p[key] }));

  const tierFolderLocked = (tier: Tier) => {
    if (isAdmin) return false;
    return userTier !== tier;
  };
  const handleTierFolderClick = (tier: Tier) => {
    const locked = tierFolderLocked(tier);
    if (!locked) {
      toggleFolder(`tier-${tier}`);
      return;
    }
    // upsell only when user has lower hierarchical tier than required
    if (
      isHierarchical(userTier) &&
      isHierarchical(tier) &&
      tierRank(userTier) < tierRank(tier)
    ) {
      setUpsellTier(tier as "pro" | "vip");
    }
    // else: silently locked (KIDS/TEENS isolation, or downgrade)
  };

  return (
    <div className="space-y-6 max-w-6xl page-transition">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("communities.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("communities.subtitle")}</p>
      </div>

      {/* === Card VIP: Aula particular com o professor === */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{t("communities.teacher.title")}</h3>
              <Badge variant="default" className="text-[10px] gap-1"><Crown className="h-3 w-3" /> VIP</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("communities.teacher.desc")}</p>
          </div>
          {userTier === "vip" && teacherUrl ? (
            <Button asChild>
              <a href={teacherUrl} target="_blank" rel="noopener noreferrer">
                 {t("communities.chat")}{"\n"} <ExternalLink className="ml-1.5 h-4 w-4" />
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

      {/* === Folder-style hierarchy === */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-2 border-b">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">{t("communities.folder")}</h2>
          </div>

          {/* General (all_tiers) groups at the root */}
          {generalItems.length > 0 && (
            <div className="space-y-1 mb-2">
              {generalItems.map((item) => (
                <SubfolderRow
                  key={item.id}
                  item={item}
                  isOpen={!!openFolders[item.id]}
                  onToggle={() => toggleFolder(item.id)}
                  onJoin={() => setSelected(item)}
                />
              ))}
            </div>
          )}

          {/* Tier folders */}
          <div className="space-y-1">
            {TIER_ORDER.map((tier) => {
              const tierItems = groupedByTier[tier];
              if (tierItems.length === 0) return null;
              const folderKey = `tier-${tier}`;
              const isOpen = !!openFolders[folderKey];
              const locked = tierFolderLocked(tier);
              return (
                <div key={tier}>
                  <button
                    type="button"
                    onClick={() => handleTierFolderClick(tier)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                  >
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen && !locked ? "rotate-90" : ""}`}
                    />
                    {isOpen && !locked ? (
                      <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Folder className={`h-5 w-5 shrink-0 ${locked ? "text-muted-foreground" : "text-primary"}`} />
                    )}
                    <span className={`font-medium text-sm ${locked ? "text-muted-foreground" : "text-foreground"}`}>
                      {TIER_LABELS[tier]}
                    </span>
                    <Badge variant="secondary" className="text-[10px] border-0 uppercase ml-1">
                      {tier}
                    </Badge>
                    {locked && (
                      <Badge variant="secondary" className="text-[10px] border-0 gap-1 ml-auto">
                        <Lock className="h-3 w-3" /> Bloqueado
                      </Badge>
                    )}
                  </button>
                  {isOpen && !locked && (
                    <div className="ml-6 pl-3 border-l border-border space-y-1 my-1">
                      {tierItems.map((item) => (
                        <SubfolderRow
                          key={item.id}
                          item={item}
                          isOpen={!!openFolders[item.id]}
                          onToggle={() => toggleFolder(item.id)}
                          onJoin={() => setSelected(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {items.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma comunidade disponível.
            </p>
          )}
        </CardContent>
      </Card>

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
            {paidChatUrl ? (
              <Button asChild className="w-full">
                <a href={paidChatUrl} target="_blank" rel="noopener noreferrer">
                  Conversar sobre {upsellTier === "vip" ? "VIP" : "PRO"} <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            ) : upsellCheckoutUrl ? (
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
