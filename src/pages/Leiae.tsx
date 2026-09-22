import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookText, Languages, Volume2, Image as ImageIcon, Loader2, Play, HelpCircle } from "lucide-react";
import { useLeiae } from "@/hooks/useLeiae";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import { useLanguage } from "@/contexts/LanguageContext";

import { LEVELS, type Level } from "@/lib/levels";
import { useAllowedLevels } from "@/hooks/useAllowedLevels";
import InlineQuiz from "@/components/InlineQuiz";

interface LeiaeText {
  id: string;
  title: string;
  content: string;
  level: Level;
  display_order: number;
  unit?: number | null;
}

interface BstQuizRow {
  id: string;
  title: string;
  passing_score: number;
  display_order: number;
  unit: number | null;
}

export default function Leiae({
  bstProductId,
  fixedLevel,
  unit,
  showBstQuizzes = false,
}: { bstProductId?: string; fixedLevel?: Level; unit?: number; showBstQuizzes?: boolean } = {}) {
  const bstMode = !!bstProductId;
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<Level>("A1");
  const { levels: allowedLevels } = useAllowedLevels();
  useEffect(() => {
    if (allowedLevels.length && !allowedLevels.includes(level)) setLevel(allowedLevels[0] as Level);
  }, [allowedLevels, level]);
  const [items, setItems] = useState<LeiaeText[]>([]);
  const [quizzes, setQuizzes] = useState<BstQuizRow[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<BstQuizRow | null>(null);
  const [activeQuizText, setActiveQuizText] = useState<LeiaeText | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const { open, loading } = useLeiae("pt-BR");

  useEffect(() => {
    (async () => {
      const q = supabase.from("leiae_texts").select("*");
      const itemsPromise = (bstMode
        ? q.eq("bst_product_id", bstProductId)
        : q.is("bst_product_id", null)
      ).order("display_order");
      const quizPromise = showBstQuizzes && bstProductId
        ? supabase
            .from("quizzes")
            .select("id,title,passing_score,display_order,unit")
            .eq("bst_product_id", bstProductId)
            .eq("level", fixedLevel ?? level)
            .order("display_order")
        : Promise.resolve({ data: [] });
      const [{ data }, { data: quizData }] = await Promise.all([itemsPromise, quizPromise]);
      setItems((data as LeiaeText[]) || []);
      setQuizzes((quizData as BstQuizRow[]) || []);
      setLoadingItems(false);
    })();
  }, [bstProductId, bstMode, fixedLevel, level, showBstQuizzes]);

  const levelItems = useMemo(() => {
    let list = items;
    if (unit) list = list.filter((x) => x.unit === unit);
    if (fixedLevel) list = list.filter((x) => x.level === fixedLevel);
    else if (!bstMode) list = list.filter((x) => x.level === level);
    if (!bstMode) return list;
    return [...list].sort(
      (a, b) => (a.unit ?? 99) - (b.unit ?? 99) || a.display_order - b.display_order,
    );
  }, [items, level, bstMode, fixedLevel, unit]);

  const handleOpen = () => {
    const content = text.trim();
    if (!content) {
      toast.info("Cole ou digite um texto para a IA Leiaê ler com você.");
      return;
    }
    open([
      {
        title: title.trim() || "Leitura interativa",
        content,
        lang: "en",
        mimeType: "text/plain",
      },
    ]);
  };

  const openSaved = (x: LeiaeText) => {
    open([{ title: x.title, content: x.content, lang: "en", mimeType: "text/plain" }]);
  };

  const quizForText = (x: LeiaeText) => quizzes.find((quiz) => quiz.unit === x.unit);

  if (activeQuiz && activeQuizText) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => { setActiveQuiz(null); setActiveQuizText(null); }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Todos os textos
        </Button>
        <InlineQuiz
          quizId={activeQuiz.id}
          hasNext={false}
          contextText={activeQuizText.content}
          contextTitle={activeQuizText.title}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {!bstMode && <BackToDashboardButton className="-ml-2 text-muted-foreground hover:text-foreground" />}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">IA Leiaê{bstMode ? " BST" : ""}</h1>
          <Badge className="bg-primary/15 text-primary border-0">{t("leiae.badge")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t("leiae.subtitle")}</p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Languages, label: t("leiae.feature.translation") },
          { icon: Volume2, label: t("leiae.feature.audio") },
          { icon: BookText, label: t("leiae.feature.syllables") },
          { icon: ImageIcon, label: t("leiae.feature.images") },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground"
          >
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{t("leiae.textsByLevel")}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 overflow-hidden">
          {!bstMode && !fixedLevel && (
          <div className="flex justify-center gap-2 flex-wrap">
            {allowedLevels.map((lv) => (
              <Button
                key={lv}
                size="sm"
                variant={level === lv ? "default" : "outline"}
                className="rounded-full w-11 h-11"
                onClick={() => setLevel(lv as Level)}
              >
                {lv}
              </Button>
            ))}
          </div>
          )}

          {loadingItems ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : levelItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {unit
                ? `Nenhum texto disponível na Unit ${unit} ainda.`
                : fixedLevel
                ? `Nenhum texto disponível no nível ${fixedLevel} ainda.`
                : bstMode
                  ? "Nenhum texto disponível neste produto ainda."
                  : `Nenhum texto disponível no nível ${level} ainda.`}
            </p>
          ) : (
            <div className="grid min-w-0 gap-2">
              {levelItems.map((x) => {
                const linkedQuiz = quizForText(x);
                return (
                <div key={x.id} className="flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
                  <button onClick={() => openSaved(x)} className="flex-1 min-w-0 text-left">
                    <div className="font-medium text-sm truncate">
                      {bstMode && x.unit ? `Unit ${x.unit} — ` : ""}{x.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{x.content.slice(0, 120)}…</div>
                  </button>
                  <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                    <Badge variant="outline" className="shrink-0">{x.level}</Badge>
                    <Button size="sm" onClick={() => openSaved(x)} className="min-w-0 flex-1 sm:flex-none">
                      <Play className="h-4 w-4 mr-1" /> Ler
                    </Button>
                    {linkedQuiz && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-w-0 flex-1 sm:flex-none"
                        onClick={() => { setActiveQuiz(linkedQuiz); setActiveQuizText(x); }}
                      >
                        <HelpCircle className="h-4 w-4 mr-1" /> Quiz
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("leiae.pasteOwnText")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("leiae.titlePlaceholder")}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("leiae.contentPlaceholder")}
            className="min-h-[220px] font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button onClick={handleOpen} disabled={loading} size="lg">
              <BookText className="h-4 w-4 mr-2" />
              {loading ? t("leiae.opening") : t("leiae.open")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}