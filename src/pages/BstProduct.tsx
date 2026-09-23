import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Brain, BookText, CheckCircle, ChevronRight, FileText, HelpCircle, Loader2, Lock, Mic, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
type LevelTool = "leiae";

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
const MODULE0_LEVEL = "M0";
const MODULE0_TITLE = "Módulo 0 - Tutorial: Como Estudar para Provas";

interface UnitPdf { unit: number; title: string | null; pdf_url: string | null; }

interface LevelStats { total: number; read: number; earnedXp: number; totalXp: number; percent: number; }

export default function BstProduct() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<BstProduct | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("home");
  const [readingPdf, setReadingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>("");
  const [level, setLevel] = useState<LevelCode | null>(null);
  const [levelTool, setLevelTool] = useState<LevelTool | null>(null);
  const [levelPdf, setLevelPdf] = useState<UnitPdf | null>(null);
  const [module0, setModule0] = useState<UnitPdf | null>(null);
  const [module0View, setModule0View] = useState(false);
  const { isBstOnly, slug: ownedSlug, loading: bstLoading } = useBstOnly();
  const { user } = useAuth();
  const [levelStats, setLevelStats] = useState<Record<string, LevelStats>>({});

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

  const levelMode = product?.slug === LEVEL_SLUG;

  useEffect(() => {
    if (!product || !levelMode || !level) { setLevelPdf(null); return; }
    (async () => {
      const { data } = await supabase
        .from("bst_product_pdfs")
        .select("unit,title,pdf_url")
        .eq("bst_product_id", product.id)
        .eq("level", level)
        .eq("unit", 0)
        .maybeSingle();
      setLevelPdf((data as UnitPdf) || null);
    })();
  }, [product?.id, levelMode, level]);

  useEffect(() => {
    if (!product || !levelMode || !hasAccess || !user) { setLevelStats({}); return; }
    (async () => {
      const [{ data: texts }, { data: events }] = await Promise.all([
        supabase
          .from("leiae_texts")
          .select("id,title,level")
          .eq("bst_product_id", product.id),
        supabase
          .from("ai_xp_events" as any)
          .select("points,key")
          .eq("user_id", user.id)
          .eq("source", "leiae"),
      ]);
      const rows = (texts as Array<{ id: string; title: string; level: string }>) || [];
      const evs = (events as unknown as Array<{ points: number | null; key: string | null }>) || [];
      const stats: Record<string, LevelStats> = {};
      LEVELS.forEach((lv) => {
        const levelTexts = rows.filter((r) => r.level === lv.code);
        const readTitles = new Set<string>();
        let earnedXp = 0;
        levelTexts.forEach((txt) => {
          const match = evs.filter((e) => (e.key || "").includes(txt.title));
          if (match.some((e) => (e.points || 0) >= 25)) readTitles.add(txt.id);
          // soma XP uma vez por título (maior evento completo + aberturas)
          const readEvent = match.find((e) => (e.points || 0) >= 25);
          if (readEvent) earnedXp += readEvent.points || 0;
        });
        const total = levelTexts.length;
        const totalXp = total * 25;
        stats[lv.code] = {
          total,
          read: readTitles.size,
          earnedXp,
          totalXp,
          percent: total > 0 ? Math.min(100, Math.round((readTitles.size / total) * 100)) : 0,
        };
      });
      setLevelStats(stats);
    })();
  }, [product?.id, levelMode, hasAccess, user?.id]);

  useEffect(() => {
    if (!product || !levelMode) { setModule0(null); return; }
    (async () => {
      const { data } = await supabase
        .from("bst_product_pdfs")
        .select("unit,title,pdf_url")
        .eq("bst_product_id", product.id)
        .eq("level", MODULE0_LEVEL)
        .maybeSingle();
      setModule0((data as UnitPdf) || null);
    })();
  }, [product?.id, levelMode]);

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
          <ArrowLeft className="h-4 w-4 mr-1" /> Bibliotecaê BST
        </Button>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Produto não encontrado.</CardContent></Card>
      </div>
    );
  }

  const toolLabel: Record<LevelTool, string> = { leiae: "IA Leiaê" };

  const back = () => {
    if (levelMode) {
      if (module0View) { setModule0View(false); return; }
      if (levelTool) { setLevelTool(null); setView("home"); return; }
      if (level) return setLevel(null);
      navigate("/library");
      return;
    }
    if (view !== "home") return setView("home");
    navigate("/library");
  };

  const backLabel = levelMode
    ? module0View
      ? product.title
      : levelTool
        ? `${level} - ${LEVELS.find((l) => l.code === level)?.label}`
        : level
          ? product.title
          : "Bibliotecaê BST"
    : view !== "home"
      ? product.title
      : "Bibliotecaê BST";

  const showLevelHome = levelMode && view === "home" && !module0View;

  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={back}>
        <ArrowLeft className="h-4 w-4 mr-1" /> {backLabel}
      </Button>

      {((levelMode && showLevelHome) || (!levelMode && view === "home")) && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
            {levelMode && level && (
              <p className="text-sm font-semibold text-primary mt-2">
                {level} - {LEVELS.find((l) => l.code === level)?.label}
                {levelTool ? ` · ${toolLabel[levelTool]}` : ""}
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
            <div className="space-y-3">
              <button
                onClick={() => setModule0View(true)}
                className="w-full flex items-center gap-3 rounded-lg border bg-card p-5 text-left hover:border-primary hover:bg-muted/40 transition"
              >
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="flex-1 text-sm font-semibold text-foreground">{MODULE0_TITLE}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
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
            </div>
          ) : levelMode && !levelTool ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <FileText className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">PDF do produto</div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!levelPdf?.pdf_url}
                    onClick={() => {
                      if (!levelPdf?.pdf_url) return;
                      setPdfUrl(levelPdf.pdf_url);
                      setPdfTitle(`${product.title} — ${level}`);
                      setReadingPdf(true);
                    }}
                  >
                    {levelPdf?.pdf_url ? "Abrir e baixar" : "Indisponível"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3 text-center">
                  <BookText className="h-7 w-7 mx-auto text-primary" />
                  <div className="text-sm font-semibold">IA Leiaê</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => { setLevelTool("leiae"); setView("tool"); }}
                  >
                    Abrir textos
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
                    onClick={() => { setPdfUrl(product.pdf_url); setPdfTitle(product.title); setReadingPdf(true); }}
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

          <Badge variant="outline" className="text-[10px]">Ambiente exclusivo Bibliotecaê BST</Badge>
        </>
      )}

      {levelMode && module0View && hasAccess && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{MODULE0_TITLE}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tutorial em PDF com o método de estudo para provas e exames.
            </p>
          </div>
          <Card className="max-w-sm">
            <CardContent className="p-5 space-y-3 text-center">
              <FileText className="h-7 w-7 mx-auto text-primary" />
              <div className="text-sm font-semibold">{module0?.title || "PDF do tutorial"}</div>
              <Button
                size="sm"
                className="w-full"
                disabled={!module0?.pdf_url}
                onClick={() => {
                  if (!module0?.pdf_url) return;
                  setPdfUrl(module0.pdf_url);
                  setPdfTitle(MODULE0_TITLE);
                  setReadingPdf(true);
                }}
              >
                {module0?.pdf_url ? "Abrir e baixar" : "Indisponível"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {view === "primary" && hasAccess && (
        levelMode && module0View ? null :
        product.primary_tool === "quiz" || levelMode
          ? <BstQuiz bstProductId={product.id} level={levelMode && level ? level : undefined} />
          : <Memorizae bstProductId={product.id} />
      )}
      {view === "tool" && hasAccess && (
        product.secondary_tool === "leiae" || levelMode
          ? <Leiae
              bstProductId={product.id}
              fixedLevel={levelMode && level ? level : undefined}
              showBstQuizzes={levelMode}
            />
          : <BstFalae bstProductId={product.id} />
      )}

      {readingPdf && pdfUrl && (
        <PdfReader
          isOpen={readingPdf}
          onClose={() => setReadingPdf(false)}
          url={pdfUrl}
          title={pdfTitle || product.title}
          allowDownload
        />
      )}
    </div>
  );
}
