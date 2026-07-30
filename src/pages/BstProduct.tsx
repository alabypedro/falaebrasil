import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, BookText, FileText, Loader2, Lock, Mic } from "lucide-react";
import { PdfReader } from "@/components/library/PdfReader";
import Memorizae from "@/pages/Memorizae";
import Leiae from "@/pages/Leiae";
import BstFalae from "@/pages/BstFalae";

interface BstProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pdf_url: string | null;
  secondary_tool: "falae" | "leiae";
  checkout_url: string | null;
}

type View = "home" | "memorizae" | "tool";

export default function BstProduct() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<BstProduct | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("home");
  const [readingPdf, setReadingPdf] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bst_products")
        .select("id,slug,title,description,pdf_url,secondary_tool,checkout_url")
        .eq("slug", slug)
        .maybeSingle();
      const p = (data as BstProduct) || null;
      setProduct(p);
      if (p) {
        const { data: access } = await supabase.rpc("has_bst_product_access", { _product_id: p.id });
        setHasAccess(!!access);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Biblioteca BST
        </Button>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Produto não encontrado.</CardContent></Card>
      </div>
    );
  }

  const back = () => (view === "home" ? navigate("/library") : setView("home"));

  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={back}>
        <ArrowLeft className="h-4 w-4 mr-1" /> {view === "home" ? "Biblioteca BST" : product.title}
      </Button>

      {view === "home" && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
          </div>

          {!hasAccess ? (
            <Card className="border-primary/30">
              <CardContent className="p-6 space-y-3 text-center">
                <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem acesso a este produto BST. Adquira para liberar o PDF e as ferramentas de IA
                  exclusivas deste guia.
                </p>
                {product.checkout_url && (
                  <Button asChild>
                    <a href={product.checkout_url} target="_blank" rel="noopener noreferrer">Comprar agora</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <FileText className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">PDF do produto</div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!product.pdf_url}
                    onClick={() => setReadingPdf(true)}
                  >
                    {product.pdf_url ? "Abrir e baixar" : "Indisponível"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <Brain className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">IA Memorizaê</div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setView("memorizae")}>
                    Treinar flashcards
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  {product.secondary_tool === "leiae" ? (
                    <BookText className="h-7 w-7 mx-auto text-primary" />
                  ) : (
                    <Mic className="h-7 w-7 mx-auto text-primary" />
                  )}
                  <div className="text-sm font-semibold">
                    {product.secondary_tool === "leiae" ? "IA Leiaê" : "IA Falaê (scripted)"}
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setView("tool")}>
                    {product.secondary_tool === "leiae" ? "Ler com a IA" : "Praticar fala"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <Badge variant="outline" className="text-[10px]">Ambiente exclusivo Biblioteca BST</Badge>
        </>
      )}

      {view === "memorizae" && hasAccess && <Memorizae bstProductId={product.id} />}
      {view === "tool" && hasAccess && (
        product.secondary_tool === "leiae"
          ? <Leiae bstProductId={product.id} />
          : <BstFalae bstProductId={product.id} />
      )}

      {readingPdf && product.pdf_url && (
        <PdfReader
          isOpen={readingPdf}
          onClose={() => setReadingPdf(false)}
          url={product.pdf_url}
          title={product.title}
          allowDownload
        />
      )}
    </div>
  );
}
