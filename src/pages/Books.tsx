import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookText, Languages, Volume2, Image as ImageIcon, Loader2, Play, Headphones, HelpCircle, ArrowLeft } from "lucide-react";
import { useLeiae } from "@/hooks/useLeiae";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import ChapterAudioPlayer from "@/components/books/ChapterAudioPlayer";
import InlineQuiz from "@/components/InlineQuiz";
import { LEVELS, type Level } from "@/lib/levels";
import { useAllowedLevels, useBooksAccess } from "@/hooks/useAllowedLevels";
import AiProgressPanel from "@/components/AiProgressPanel";


interface BookText {
  id: string;
  title: string;
  author: string | null;
  content: string;
  audio_url: string | null;
  level: Level;
  display_order: number;
}

interface QuizRow {
  id: string;
  title: string;
  passing_score: number;
  display_order: number;
  level: string;
  book_text_id: string | null;
}


export default function Books() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<BookText[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [audio, setAudio] = useState<BookText | null>(null);
  const [quizRows, setQuizRows] = useState<QuizRow[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizRow | null>(null);
  const { t } = useLanguage();
  const { open, loading } = useLeiae("pt-BR");
  const { levels: allowedLevels } = useAllowedLevels();
  const hasBooksAccess = useBooksAccess();

  useEffect(() => {
    if (allowedLevels.length && !allowedLevels.includes(level)) setLevel(allowedLevels[0] as Level);
  }, [allowedLevels, level]);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: quizzes }] = await Promise.all([
        supabase.from("book_texts" as any).select("*").order("level").order("display_order"),
        supabase
          .from("quizzes" as any)
          .select("id, title, passing_score, display_order, level, book_text_id")
          .not("book_text_id", "is", null)
          .order("display_order")
          .order("title"),
      ]);
      setItems((data as unknown as BookText[]) || []);
      setQuizRows((quizzes as unknown as QuizRow[]) || []);
      setLoadingItems(false);
    })();
  }, []);

  const quizByText = useMemo(() => {
    const map: Record<string, QuizRow> = {};
    quizRows.forEach((q) => { if (q.book_text_id) map[q.book_text_id] = q; });
    return map;
  }, [quizRows]);


  const visibleItems = useMemo(
    () => items.filter((x) => allowedLevels.includes(x.level)),
    [items, allowedLevels],
  );

  const levelItems = useMemo(
    () => items.filter((x) => x.level === level && allowedLevels.includes(x.level)),
    [items, level, allowedLevels],
  );

  const textById = useMemo(() => {
    const map: Record<string, BookText> = {};
    items.forEach((x) => { map[x.id] = x; });
    return map;
  }, [items]);

  // Quizzes do nível atual, ordenados igual ao modelo BST
  const levelQuizzes = useMemo(() => {
    return quizRows
      .filter((q) => {
        const bt = q.book_text_id ? textById[q.book_text_id] : undefined;
        return bt ? bt.level === level : false;
      })
      .sort((a, b) => {
        const oa = textById[a.book_text_id!]?.display_order ?? a.display_order ?? 0;
        const ob = textById[b.book_text_id!]?.display_order ?? b.display_order ?? 0;
        if (oa !== ob) return oa - ob;
        return a.title.localeCompare(b.title);
      });
  }, [quizRows, textById, level]);

  const activeContext = activeQuiz?.book_text_id ? textById[activeQuiz.book_text_id] : undefined;


  const handleOpen = () => {
    const content = text.trim();
    if (!content) {
      toast.info("Cole ou digite um texto para ler de forma interativa.");
      return;
    }
    open([{ title: title.trim() || "Leitura interativa", content, lang: "en", mimeType: "text/plain" }]);
  };

  const openSaved = (x: BookText) => {
    open([{ title: x.title, content: x.content, lang: "en", mimeType: "text/plain" }]);
  };

  if (!hasBooksAccess) {
    return (
      <div className="space-y-6 max-w-2xl">
        <BackToDashboardButton className="-ml-2 text-muted-foreground hover:text-foreground" />
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <BookText className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">{t("nav.library.books")}</p>
            <p className="text-sm text-muted-foreground">
              Este conteúdo não está liberado para a sua conta.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeQuiz) {
    const idx = levelQuizzes.findIndex((q) => q.id === activeQuiz.id);
    const nextQuiz = levelQuizzes[idx + 1];
    return (
      <div className="space-y-4 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => setActiveQuiz(null)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Todos os quizzes
        </Button>
        <InlineQuiz
          quizId={activeQuiz.id}
          hasNext={!!nextQuiz}
          onNext={() => setActiveQuiz(nextQuiz ?? null)}
          contextText={activeContext?.content ?? null}
          contextTitle={activeContext?.title ?? null}
        />
      </div>
    );
  }

  return (

    <div className="space-y-6 max-w-4xl">
      <BackToDashboardButton className="-ml-2 text-muted-foreground hover:text-foreground" />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{t("nav.library.books")}</h1>
          <Badge className="bg-primary/15 text-primary border-0">Leitura interativa</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Contos e livros graduados por nível, com tradução instantânea, sílabas e leitura em voz alta.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { icon: Languages, label: "Tradução instantânea" },
          { icon: Volume2, label: "Ouça a pronúncia" },
          { icon: BookText, label: "Divisão silábica" },
          { icon: ImageIcon, label: "Dicionário de imagens" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <AiProgressPanel
        title="Progresso da IA Leiaê"
        subtitle={`Leituras de Estórias Curtas no nível ${level}.`}
        source="books"
        total={visibleItems.length}
        completedLabel="leituras estimadas"
        totalLabel="livros"
        icon={BookText}
        stats={[
          { label: "livros disponíveis", value: visibleItems.length },
          { label: "níveis liberados", value: allowedLevels.length },
          { label: "quizzes vinculados", value: quizRows.length },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Livros por nível</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {loadingItems ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : levelItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Nenhum livro disponível no nível {level} ainda.
            </p>
          ) : (
            <div className="grid gap-2">
              {levelItems.map((x) => (
                <div key={x.id} className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                    <button onClick={() => openSaved(x)} className="flex-1 min-w-0 text-left">
                      <div className="font-medium text-sm truncate">{x.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {x.author ? `${x.author} — ` : ""}{x.content.slice(0, 120)}…
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {x.audio_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setAudio(audio?.id === x.id ? null : x)}
                        >
                          <Headphones className="h-4 w-4" />
                        </Button>
                      )}
                      <Badge variant="outline" className="shrink-0">{x.level}</Badge>
                      <Button size="sm" onClick={() => openSaved(x)} className="shrink-0">
                        <Play className="h-4 w-4 mr-1" /> Ler
                      </Button>
                      {quizByText[x.id] && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() => setActiveQuiz(quizByText[x.id])}
                        >
                          <HelpCircle className="h-4 w-4 mr-1" /> Quiz
                        </Button>
                      )}
                    </div>
                  </div>
                  {audio?.id === x.id && x.audio_url && (
                    <div className="p-3 pt-0">
                      <ChapterAudioPlayer src={x.audio_url} label={`Audiolivro — ${x.title}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>




      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cole seu próprio texto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o conto ou capítulo em inglês…"
            className="min-h-[220px] font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button onClick={handleOpen} disabled={loading} size="lg">
              <BookText className="h-4 w-4 mr-2" />
              {loading ? "Abrindo…" : "Abrir leitura interativa"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
