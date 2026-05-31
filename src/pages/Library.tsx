import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Headphones, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UpsellModal } from "@/components/UpsellModal";
import { useAdmin } from "@/hooks/useAdmin";
import { PdfReader } from "@/components/library/PdfReader";

interface LibraryItem {
  id: string;
  title: string;
  type: string;
  file_url: string | null;
  audio_url: string | null;
  access_key: string;
}

interface ProductInfo {
  product_key: string;
  display_name: string;
  checkout_url: string | null;
}

const accessToProductKey: Record<string, "ebook1" | "ebook2" | "ebook3" | null> = {
  ebook1: "ebook1",
  ebook2: "ebook2",
  ebook3: "ebook3",
  free: null,
};

/** Normaliza o título removendo prefixos "Ebook"/"Audiobook" e acentos para agrupar pares. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*(e-?book|audiobook|audio book)\s*[:\-]?\s*/i, "")
    .trim();
}

/** Ordena alfabeticamente pelo título base e, dentro do mesmo título, e-book antes de audiobook. */
function sortLibrary(items: LibraryItem[]): LibraryItem[] {
  return [...items].sort((a, b) => {
    const ka = normalizeTitle(a.title);
    const kb = normalizeTitle(b.title);
    if (ka !== kb) return ka.localeCompare(kb, "pt-BR");
    if (a.type === b.type) return a.title.localeCompare(b.title, "pt-BR");
    return a.type === "ebook" ? -1 : 1;
  });
}

function ItemCard({
  item,
  locked,
  onUnlockClick,
  onReadClick,
}: {
  item: LibraryItem;
  locked: boolean;
  onUnlockClick: () => void;
  onReadClick: (item: LibraryItem) => void;
}) {
  // Defesa em profundidade: se a URL não veio (a view safe nulifica quando não há acesso),
  // tratamos como bloqueado independentemente do que o estado do client diga.
  const missingAsset =
    (item.type === "ebook" && !item.file_url) ||
    (item.type === "audiobook" && !item.audio_url);
  const effectivelyLocked = locked || missingAsset;

  if (effectivelyLocked) {
    return (
      <Card className="hover:shadow-md transition-shadow opacity-90">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <span className="text-4xl grayscale">{item.type === "ebook" ? "📘" : "🎧"}</span>
            <Badge variant="secondary" className="text-[10px] border-0 gap-1">
              <Lock className="h-3 w-3" /> Bloqueado
            </Badge>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
          </div>
          <Button variant="default" size="sm" className="w-full" onClick={onUnlockClick}>
            <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <span className="text-4xl">{item.type === "ebook" ? "📘" : "🎧"}</span>
          <Badge variant="secondary" className="text-[10px] border-0">
            {item.type === "ebook" ? "E-book" : "Audiobook"}
          </Badge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
        </div>
        {item.type === "ebook" && item.file_url ? (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={item.file_url} target="_blank" rel="noopener noreferrer">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Ler
            </a>
          </Button>
        ) : item.type === "audiobook" && item.audio_url ? (
          <div className="space-y-2">
            <audio src={item.audio_url} controls className="w-full h-9" />
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" disabled>
            {item.type === "ebook" ? <><BookOpen className="mr-1.5 h-3.5 w-3.5" /> Indisponível</> : <><Headphones className="mr-1.5 h-3.5 w-3.5" /> Indisponível</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [loading, setLoading] = useState(true);
  const [upsellItem, setUpsellItem] = useState<LibraryItem | null>(null);
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    const load = async () => {
      // We fetch ALL items by also querying mapping (but RLS will hide what's not accessible).
      // To still show locked items, we fetch via a separate "preview" path: select only id/title/type/access_key.
      // Since RLS hides non-accessible items, we instead fetch the product mapping to know what exists,
      // and load items the user can see + show "locked" placeholders is complex. Simpler: relax via mapping list.
      // Use the safe view: file_url/audio_url come back NULL when the user lacks access,
      // even if the client tries to bypass the UI lock.
      const { data: itemsData } = await supabase.from("library_bst_safe").select("*");
      if (itemsData) setItems(sortLibrary(itemsData as LibraryItem[]));
      const { data: prodData } = await supabase
        .from("hubla_product_mapping")
        .select("product_key, display_name, checkout_url");
      if (prodData) {
        const map: Record<string, ProductInfo> = {};
        for (const p of prodData) map[p.product_key] = p as ProductInfo;
        setProducts(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const hasAccess = (accessKey: string): boolean => {
    if (isAdmin) return true;
    if (accessKey === "free") return true;
    if (!profile) return false;
    if (accessKey === "ebook1") return profile.has_ebook1_access;
    if (accessKey === "ebook2") return profile.has_ebook2_access;
    if (accessKey === "ebook3") return profile.has_ebook3_access;
    return false;
  };

  const upsellProductKey = upsellItem ? accessToProductKey[upsellItem.access_key] : null;
  const upsellProduct = upsellProductKey ? products[upsellProductKey] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl page-transition">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Biblioteca BST</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Brasil Sem Trava: E-books e Audiobooks para complementar seu aprendizado.
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="ebook">E-books</TabsTrigger>
          <TabsTrigger value="audiobook">Audiobooks</TabsTrigger>
        </TabsList>

        {["all", "ebook", "audiobook"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(tab === "all" ? items : items.filter((i) => i.type === tab)).map((item) => {
                const locked = !hasAccess(item.access_key);
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    locked={locked}
                    onUnlockClick={() => setUpsellItem(item)}
                  />
                );
              })}
            </div>
            {(tab === "all" ? items : items.filter((i) => i.type === tab)).length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum item disponível.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {upsellItem && upsellProductKey && (
        <UpsellModal
          open={!!upsellItem}
          onOpenChange={(o) => !o && setUpsellItem(null)}
          productKey={upsellProductKey}
          productName={upsellProduct?.display_name ?? upsellItem.title}
          checkoutUrl={upsellProduct?.checkout_url ?? null}
          requiresCourseFirst={!profile?.has_course_access}
          description={`Para acessar "${upsellItem.title}" você precisa adquirir o Order Bump correspondente junto com o curso Essential Pro A1.`}
        />
      )}
    </div>
  );
}
