import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookText, Sparkles, Languages, Volume2, Image as ImageIcon, Loader2, Play } from "lucide-react";
import { useLeiae } from "@/hooks/useLeiae";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import { useLanguage } from "@/contexts/LanguageContext";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = typeof LEVELS[number];

interface LeiaeText {
  id: string;
  title: string;
  content: string;
  level: Level;
  display_order: number;
}

export default function Leiae({
  bstProductId,
  fixedLevel,
}: { bstProductId?: string; fixedLevel?: Level } = {}) {
  const bstMode = !!bstProductId;
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<LeiaeText[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const { open, loading } = useLeiae("pt-BR");

  useEffect(() => {
    (async () => {
      const q = supabase.from("leiae_texts").select("*");
      const { data } = await (bstMode
        ? q.eq("bst_product_id", bstProductId)
        : q.is("bst_product_id", null)
      ).order("display_order");
      setItems((data as LeiaeText[]) || []);
      setLoadingItems(false);
    })();
  }, [bstProductId]);

  const levelItems = useMemo(() => {
    if (fixedLevel) return items.filter((x) => x.level === fixedLevel);
    return bstMode ? items : items.filter((x) => x.level === level);
  }, [items, level, bstMode, fixedLevel]);

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

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { icon: Languages, label: t("leiae.feature.translation") },
          { icon: Volume2, label: t("leiae.feature.audio") },
          { icon: BookText, label: t("leiae.feature.syllables") },
          { icon: ImageIcon, label: t("leiae.feature.images") },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground"
          >
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("leiae.textsByLevel")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!bstMode && !fixedLevel && (
          <div className="flex justify-center gap-2 flex-wrap">
            {LEVELS.map((lv) => (
              <Button
                key={lv}
                size="sm"
                variant={level === lv ? "default" : "outline"}
                className="rounded-full w-11 h-11"
                onClick={() => setLevel(lv)}
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
              {fixedLevel
                ? `Nenhum texto disponível no nível ${fixedLevel} ainda.`
                : bstMode
                  ? "Nenhum texto disponível neste produto ainda."
                  : `Nenhum texto disponível no nível ${level} ainda.`}
            </p>
          ) : (
            <div className="grid gap-2">
              {levelItems.map((x) => (
                <button
                  key={x.id}
                  onClick={() => openSaved(x)}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary hover:bg-muted/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{x.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{x.content.slice(0, 120)}…</div>
                  </div>
                  <Badge variant="outline" className="shrink-0">{x.level}</Badge>
                  <Play className="h-4 w-4 text-primary shrink-0" />
                </button>
              ))}
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