import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageCircle, Lock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";

interface Community {
  id: string;
  title: string;
  description: string | null;
  whatsapp_url: string | null;
  access_key: string;
  sort_order: number;
}

const levelOrder: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export default function Communities() {
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Community | null>(null);
  const [lockedSelected, setLockedSelected] = useState<Community | null>(null);
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fb_communities")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setItems(data as Community[]);
      setLoading(false);
    })();
  }, []);

  const hasAccess = (accessKey: string): boolean => {
    if (isAdmin) return true;
    if (accessKey === "free") return true;
    const userLevel = profile?.level ?? "A1";
    const userRank = levelOrder[userLevel] ?? 0;
    const requiredRank = levelOrder[accessKey.toUpperCase()] ?? 99;
    // Free + course access required for A1; for A2/B1/B2 must have profile level >= required
    if (accessKey === "a1") return !!profile?.has_course_access;
    return userRank >= requiredRank;
  };

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
        <h1 className="text-2xl font-bold text-foreground">Comunidades FB</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acesse os grupos de WhatsApp dos alunos Falaê Brasil!
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const locked = !hasAccess(item.access_key);
          return (
            <Card key={item.id} className={`hover:shadow-md transition-shadow ${locked ? "opacity-90" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <span className={`text-4xl ${locked ? "grayscale" : ""}`}>💬</span>
                  {locked ? (
                    <Badge variant="secondary" className="text-[10px] border-0 gap-1">
                      <Lock className="h-3 w-3" /> Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] border-0">
                      Comunidade
                    </Badge>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                </div>
                {locked ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => setLockedSelected(item)}
                  >
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">{selected?.title}</DialogTitle>
            <DialogDescription className="text-center">
              {selected?.description ?? "Grupo de WhatsApp da comunidade."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
            {selected?.whatsapp_url ? (
              <Button
                className="w-full"
                onClick={() => {
                  const url = selected.whatsapp_url!;
                  // WhatsApp bloqueia abertura via iframe (ERR_BLOCKED_BY_RESPONSE).
                  // Forçamos a navegação no contexto top (janela do navegador, fora do preview).
                  try {
                    const win = window.open(url, "_blank", "noopener,noreferrer");
                    if (!win || win.closed || typeof win.closed === "undefined") {
                      // popup bloqueado — fallback: navega a janela pai (top)
                      if (window.top) window.top.location.href = url;
                      else window.location.href = url;
                    }
                  } catch {
                    if (window.top) window.top.location.href = url;
                    else window.location.href = url;
                  }
                }}
              >
                Entrar no grupo <ExternalLink className="ml-1.5 h-4 w-4" />
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

      {/* Modal de bloqueado */}
      <Dialog open={!!lockedSelected} onOpenChange={(o) => !o && setLockedSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Comunidade bloqueada</DialogTitle>
            <DialogDescription className="text-center">
              Para acessar "{lockedSelected?.title}" você precisa ter o curso de nível{" "}
              <strong>{lockedSelected?.access_key.toUpperCase()}</strong> desbloqueado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockedSelected(null)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
