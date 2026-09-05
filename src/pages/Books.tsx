import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BookMarked,
  CheckCircle2,
  Minus,
  Moon,
  PartyPopper,
  Plus,
  Search,
  Sun,
  Volume2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import { LEVELS } from "@/lib/levels";

export const BOOK_CATEGORIES = [
  "Short Stories",
  "Culture",
  "Adventure",
  "Biography",
  "Science",
  "Business",
];

interface Book {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  level: string;
  category: string;
  cover_url: string | null;
}

interface Chapter {
  id: string;
  book_id: string;
  title: string;
  chapter_index: number;
  content: string;
  audio_url: string | null;
}

interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  example: string | null;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  display_order: number;
}

interface QuizResultDetail {
  id: string;
  correct_option_index: number;
  given: number | null;
  is_correct: boolean;
}

const speak = (text: string) => {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; details: QuizResultDetail[] } | null>(null);
  const [congrats, setCongrats] = useState(false);

  const [fontSize, setFontSize] = useState(18);
  const [dark, setDark] = useState(false);
  const [progress, setProgress] = useState(0);
  const readerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.from("books" as any) as any)
        .select("id,title,author,description,level,category,cover_url")
        .eq("published", true)
        .order("display_order");
      if (error) toast.error("Não foi possível carregar os livros.");
      setBooks(((data as Book[]) ?? []));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books
      .filter((b) => (levelFilter === "all" || b.level === levelFilter))
      .filter((b) => (categoryFilter === "all" || b.category === categoryFilter))
      .filter(
        (b) =>
          !q ||
          b.title.toLowerCase().includes(q) ||
          (b.author ?? "").toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }));
  }, [books, search, levelFilter, categoryFilter]);

  const openBook = async (b: Book) => {
    setBook(b);
    setChapter(null);
    const { data } = await (supabase.from("book_chapters" as any) as any)
      .select("id,book_id,title,chapter_index,content,audio_url")
      .eq("book_id", b.id)
      .order("chapter_index");
    const list = (data as Chapter[]) ?? [];
    setChapters(list);
    if (list.length > 0) await openChapter(list[0]);
  };

  const openChapter = async (c: Chapter) => {
    setChapter(c);
    setAnswers({});
    setResult(null);
    setCongrats(false);
    setProgress(0);
    const [{ data: g }, { data: q }] = await Promise.all([
      (supabase.from("book_glossary" as any) as any)
        .select("id,term,definition,example")
        .eq("chapter_id", c.id),
      supabase.rpc("get_book_quiz" as any, { _chapter_id: c.id }),
    ]);
    setGlossary((g as GlossaryEntry[]) ?? []);
    setQuestions(
      (((q as any[]) ?? []).map((row) => ({
        id: row.id,
        question_text: row.question_text,
        options: Array.isArray(row.options) ? row.options : [],
        display_order: row.display_order,
      })) as QuizQuestion[]),
    );
    requestAnimationFrame(() => readerRef.current?.scrollTo({ top: 0 }));
  };

  /** Salva o progresso de leitura (com throttle simples). */
  const savedRef = useRef(0);
  const saveProgress = useCallback(
    async (pct: number) => {
      if (!book || !chapter) return;
      if (pct - savedRef.current < 10 && pct < 100) return;
      savedRef.current = pct;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await (supabase.from("user_reading_progress" as any) as any).upsert(
        {
          user_id: auth.user.id,
          book_id: book.id,
          chapter_id: chapter.id,
          progress_percent: pct,
          completed: pct >= 98,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chapter_id" },
      );
    },
    [book, chapter],
  );

  const onScroll = () => {
    const el = readerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100));
    setProgress(pct);
    saveProgress(pct);
  };

  const glossaryMap = useMemo(() => {
    const m = new Map<string, GlossaryEntry>();
    glossary.forEach((g) => m.set(g.term.toLowerCase(), g));
    return m;
  }, [glossary]);

  const termsRegex = useMemo(() => {
    if (glossary.length === 0) return null;
    const terms = [...glossary]
      .sort((a, b) => b.term.length - a.term.length)
      .map((g) => escapeRegex(g.term));
    return new RegExp(`(${terms.join("|")})`, "gi");
  }, [glossary]);

  const renderParagraph = (text: string, key: string) => {
    if (!termsRegex) return <p key={key} className="mb-4 leading-relaxed">{text}</p>;
    const parts = text.split(termsRegex);
    return (
      <p key={key} className="mb-4 leading-relaxed">
        {parts.map((part, i) => {
          const entry = glossaryMap.get(part.toLowerCase());
          if (!entry) return <span key={i}>{part}</span>;
          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="underline decoration-dotted decoration-2 underline-offset-4 text-primary font-medium hover:bg-primary/10 rounded px-0.5"
                >
                  {part}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{entry.term}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => speak(entry.term)}
                    aria-label="Ouvir pronúncia"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{entry.definition}</p>
                {entry.example && (
                  <p className="text-sm italic border-l-2 border-primary/40 pl-2">{entry.example}</p>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </p>
    );
  };

  const submitQuiz = async () => {
    if (!chapter) return;
    if (Object.keys(answers).length < questions.length) {
      toast.error("Responda todas as perguntas.");
      return;
    }
    const payload: Record<string, number> = {};
    questions.forEach((q) => (payload[q.id] = answers[q.id]));
    const { data, error } = await supabase.rpc("submit_book_quiz" as any, {
      _chapter_id: chapter.id,
      _answers: payload,
    });
    if (error) {
      toast.error("Não foi possível enviar o quiz.");
      return;
    }
    const res = data as any;
    setResult(res);
    if (res.score === 100) setCongrats(true);
    toast.success(`Você acertou ${res.correct} de ${res.total}!`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ---------- READER VIEW ----------
  if (book && chapter) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { setBook(null); setChapter(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Livros
          </Button>
          <BackToDashboardButton />
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">{book.title}</h1>
            <p className="text-sm text-muted-foreground">
              {chapter.title} {book.author ? `• ${book.author}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setFontSize((f) => Math.max(14, f - 2))} aria-label="Diminuir fonte">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums w-10 text-center">{fontSize}px</span>
            <Button variant="outline" size="icon" onClick={() => setFontSize((f) => Math.min(30, f + 2))} aria-label="Aumentar fonte">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setDark((d) => !d)} aria-label="Alternar modo de leitura">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {chapter.audio_url && (
          <div className="sticky top-2 z-20">
            <ChapterAudioPlayer src={chapter.audio_url} label={`Narração — ${chapter.title}`} />
          </div>
        )}

        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-[11px] text-muted-foreground tabular-nums">{progress}% lido</p>
        </div>

        {chapters.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {chapters.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={c.id === chapter.id ? "default" : "outline"}
                onClick={() => openChapter(c)}
              >
                {c.chapter_index}. {c.title}
              </Button>
            ))}
          </div>
        )}

        <div
          ref={readerRef}
          onScroll={onScroll}
          className={`max-h-[60vh] overflow-y-auto rounded-xl border p-5 ${
            dark ? "bg-zinc-900 text-zinc-100 border-zinc-700" : "bg-card text-foreground border-border"
          }`}
          style={{ fontSize }}
        >
          {chapter.content.split(/\n{1,}/).filter((p) => p.trim()).map((p, i) => renderParagraph(p, `p-${i}`))}
        </div>

        {questions.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-primary" /> Comprehension Quiz
              </h2>
              {questions.map((q, qi) => {
                const detail = result?.details.find((d) => d.id === q.id);
                return (
                  <div key={q.id} className="space-y-2">
                    <p className="text-sm font-medium">
                      {qi + 1}. {q.question_text}
                    </p>
                    <div className="grid gap-2">
                      {q.options.map((opt, oi) => {
                        const selected = answers[q.id] === oi;
                        const isRight = detail && detail.correct_option_index === oi;
                        const isWrongPick = detail && detail.given === oi && !detail.is_correct;
                        return (
                          <button
                            key={oi}
                            disabled={!!result}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                            className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition ${
                              isRight
                                ? "border-emerald-500 bg-emerald-500/10"
                                : isWrongPick
                                  ? "border-destructive bg-destructive/10"
                                  : selected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/60"
                            }`}
                          >
                            <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span>
                            <span className="flex-1">{opt}</span>
                            {isRight && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {isWrongPick && <XCircle className="h-4 w-4 text-destructive" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {result ? (
                <p className="text-sm font-semibold">
                  Resultado: {result.correct}/{result.total} ({result.score}%) — XP concedido.
                </p>
              ) : (
                <Button onClick={submitQuiz}>Verificar respostas</Button>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={congrats} onOpenChange={setCongrats}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <PartyPopper className="h-5 w-5 text-primary" /> Parabéns!
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Você acertou 100% do quiz de compreensão deste capítulo.
            </p>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---------- GALLERY ----------
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Livros e audio-livros</h1>
          <p className="text-sm text-muted-foreground">
            Contos e livros graduados do A1 ao C2, com narração e quiz de compreensão.
          </p>
        </div>
        <BackToDashboardButton />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, autor ou categoria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger><SelectValue placeholder="Nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {BOOK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Nenhum livro disponível ainda.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => openBook(b)}
              className="group text-left rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary transition"
            >
              <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
                {b.cover_url ? (
                  <img src={b.cover_url} alt={`Capa de ${b.title}`} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <BookMarked className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{b.level}</Badge>
                  <span className="text-[11px] text-muted-foreground truncate">{b.category}</span>
                </div>
                <p className="text-sm font-semibold leading-tight line-clamp-2">{b.title}</p>
                {b.author && <p className="text-[11px] text-muted-foreground truncate">{b.author}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
