import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import BackToDashboardButton from "@/components/BackToDashboardButton";

interface BstProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  checkout_url: string | null;
}

export default function Library() {
  const [products, setProducts] = useState<BstProduct[]>([]);
  const [accessIds, setAccessIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bst_products")
        .select("id,slug,title,description,checkout_url")
        .eq("active", true);
      const list = ((data as BstProduct[]) || []).sort((a, b) =>
        a.title.localeCompare(b.title, "pt-BR")
      );
      setProducts(list);

      const granted = new Set<string>();
      await Promise.all(
        list.map(async (p) => {
          const { data: ok } = await supabase.rpc("has_bst_product_access", { _product_id: p.id });
          if (ok) granted.add(p.id);
        })
      );
      setAccessIds(granted);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <BackToDashboardButton className="-ml-2 text-muted-foreground hover:text-foreground" />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Biblioteca BST</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Brasil Sem Trava: Guias, Cartilhas e Manuais - ferramentas de treinamento para uso prático em situações
          específicas.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum produto disponível ainda.</CardContent></Card>
      ) : (
        <ol className="space-y-2">
          {products.map((p, i) => {
            const unlocked = accessIds.has(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => navigate(`/library/${p.slug}`)}
                  className="w-full flex items-center gap-4 rounded-lg border bg-card p-4 text-left hover:border-primary hover:bg-muted/40 transition"
                >
                  <span className="text-sm font-mono text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{p.title}</span>
                    {p.description && (
                      <span className="block text-xs text-muted-foreground truncate">{p.description}</span>
                    )}
                  </span>
                  {unlocked ? (
                    <Badge variant="secondary" className="text-[10px] border-0 shrink-0">Liberado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                      <Lock className="h-3 w-3" /> Bloqueado
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
