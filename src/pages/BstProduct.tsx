import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, BookText, FileText, HelpCircle, Loader2, Lock, Mic } from "lucide-react";
import { PdfReader } from "@/components/library/PdfReader";
import Memorizae from "@/pages/Memorizae";
import Leiae from "@/pages/Leiae";
import BstFalae from "@/pages/BstFalae";
import BstQuiz from "@/pages/BstQuiz";
import { useBstOnly } from "@/hooks/useBstOnly";

interface BstProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pdf_url: string | null;
  primary_tool: "memorizae" | "quiz";
  secondary_tool: "falae" | "leiae";
  checkout_url: string | null;
}

type View = "home" | "primary" | "tool";

const LEVEL_SLUG = "bst-cartilha-de-ingles-instrumental-do-zero-a1-ao-c2-avancado";
const LEVELS = [
  { code: "A1", label: "Básico" },
  { code: "A2", label: "Pré-Intermediário" },
  { code: "B1", label: "Intermediário" },
  { code: "B2", label: "Pós-Intermediário" },
  { code: "C1", label: "Pré-Avançado" },
  { code: "C2", label: "Avançado" },
] as const;
type LevelCode = typeof LEVELS[number]["code"];

export default function BstProduct() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<BstProduct | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("home");
  const [readingPdf, setReadingPdf] = useState(false);
  const [level, setLevel] = useState<LevelCode | null>(null);
  const { isBstOnly, slug: ownedSlug, loading: bstLoading } = useBstOnly();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bst_products")
        .select("id,slug,title,description,pdf_url,primary_tool,secondary_tool,checkout_url")
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

  if (loading || bstLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Aluno restrito (BST only) não pode abrir produto que não comprou
  if (isBstOnly && product && !hasAccess) {
    return <Navigate to={ownedSlug ? `/library/${ownedSlug}` : "/library"} replace />;
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

  const levelMode = product?.slug === LEVEL_SLUG;

  const back = () => {
    if (view !== "home") return setView("home");
    if (levelMode && level) return setLevel(null);
    navigate("/library");
  };

  const backLabel = view !== "home" ? product.title : levelMode && level ? product.title : "Biblioteca BST";

  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={back}>
        <ArrowLeft className="h-4 w-4 mr-1" /> {backLabel}
      </Button>

      {view === "home" && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
            {levelMode && level && (
              <p className="text-sm font-semibold text-primary mt-2">
                {level} - {LEVELS.find((l) => l.code === level)?.label}
              </p>
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
          ) : levelMode && !level ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LEVELS.map((lv) => (
                <button
                  key={lv.code}
                  onClick={() => setLevel(lv.code)}
                  className="rounded-lg border bg-card p-5 text-left hover:border-primary hover:bg-muted/40 transition"
                >
                  <span className="block text-lg font-bold text-primary">{lv.code}</span>
                  <span className="block text-sm font-semibold text-foreground">{lv.label}</span>
                </button>
              ))}
            </div>
          ) : levelMode ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <FileText className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">PDF do produto</div>
                  <Button size="sm" className="w-full" disabled={!product.pdf_url} onClick={() => setReadingPdf(true)}>
                    {product.pdf_url ? "Abrir e baixar" : "Indisponível"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <BookText className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">IA Leiaê</div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setView("tool")}>
                    Ler com a IA
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <HelpCircle className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">Quizz</div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setView("primary")}>
                    Responder quizzes
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                  {product.primary_tool === "quiz" ? (
                    <HelpCircle className="h-7 w-7 mx-auto text-primary" />
                  ) : (
                    <Brain className="h-7 w-7 mx-auto text-primary" />
                  )}
                  <div className="text-sm font-semibold">
                    {product.primary_tool === "quiz" ? "Quizz" : "IA Memorizaê"}
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setView("primary")}>
                    {product.primary_tool === "quiz" ? "Responder quizzes" : "Treinar flashcards"}
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

      {view === "primary" && hasAccess && (
        product.primary_tool === "quiz" || levelMode
          ? <BstQuiz bstProductId={product.id} level={levelMode && level ? level : undefined} />
          : <Memorizae bstProductId={product.id} />
      )}
      {view === "tool" && hasAccess && (
        product.secondary_tool === "leiae" || levelMode
          ? <Leiae bstProductId={product.id} fixedLevel={levelMode && level ? level : undefined} />
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
