import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BookMarked, Headphones, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LEVELS } from "@/lib/levels";
import { BOOK_CATEGORIES } from "@/pages/Books";
import {
  fetchLibrivoxTracks,
  formatTrackDuration,
  searchLibrivoxWorks,
  type LibrivoxTrack,
  type LibrivoxWork,
} from "@/lib/librivox";

interface Book {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  level: string;
  category: string;
  cover_url: string | null;
  published: boolean;
  display_order: number;
}

interface Chapter {
  id: string;
  book_id: string;
  title: string;
  chapter_index: number;
  content: string;
  audio_url: string | null;
}

interface Glossary {
  id?: string;
  term: string;
  definition: string;
  example: string;
}

interface Question {
  id?: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  display_order: number;
}

const emptyBook = {
  title: "",
  author: "",
  description: "",
  level: "A1",
  category: BOOK_CATEGORIES[0],
  cover_url: "",
  published: true,
  display_order: 0,
};

const tbl = (name: string) => supabase.from(name as any) as any;

export default function BooksManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [bookOpen, setBookOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState({ ...emptyBook });
  const [saving, setSaving] = useState(false);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [chapterOpen, setChapterOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterForm, setChapterForm] = useState({ title: "", chapter_index: 1, content: "", audio_url: "" });
  const [glossary, setGlossary] = useState<Glossary[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // ---- Internet Archive / LibriVox ----
  const [lvOpen, setLvOpen] = useState(false);
  const [lvMode, setLvMode] = useState<"bulk" | "chapter">("bulk");
  const [lvQuery, setLvQuery] = useState("");
  const [lvLoading, setLvLoading] = useState(false);
  const [lvResults, setLvResults] = useState<LibrivoxWork[]>([]);
  const [lvWork, setLvWork] = useState<LibrivoxWork | null>(null);
  const [lvTracks, setLvTracks] = useState<LibrivoxTrack[]>([]);

  const openLibrivox = (mode: "bulk" | "chapter") => {
    setLvMode(mode);
    setLvWork(null);
    setLvTracks([]);
    setLvOpen(true);
    const seed = mode === "chapter" ? chapterForm.title : `${selectedBook?.title ?? ""} ${selectedBook?.author ?? ""}`;
    setLvQuery((q) => q || seed.trim());
  };

  const runLibrivoxSearch = async () => {
    setLvLoading(true);
    setLvWork(null);
    setLvTracks([]);
    try {
      setLvResults(await searchLibrivoxWorks(lvQuery));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na busca.");
    } finally {
      setLvLoading(false);
    }
  };

  const selectLibrivoxWork = async (w: LibrivoxWork) => {
    setLvWork(w);
    setLvLoading(true);
    try {
      const tracks = await fetchLibrivoxTracks(w.identifier);
      setLvTracks(tracks);
      if (tracks.length === 0) toast.error("Nenhum arquivo .mp3 encontrado nesta obra.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar os áudios.");
    } finally {
      setLvLoading(false);
    }
  };

  /** Aplica as faixas em sequência aos capítulos já cadastrados. */
  const applyTracksToChapters = async () => {
    if (!selectedBook || lvTracks.length === 0) return;
    const ordered = [...chapters].sort((a, b) => a.chapter_index - b.chapter_index);
    if (ordered.length === 0) { toast.error("Cadastre os capítulos antes de vincular o áudio."); return; }
    setSaving(true);
    let applied = 0;
    for (let i = 0; i < ordered.length && i < lvTracks.length; i++) {
      const { error } = await tbl("book_chapters").update({ audio_url: lvTracks[i].url }).eq("id", ordered[i].id);
      if (!error) applied++;
    }
    setSaving(false);
    toast.success(`Áudio vinculado a ${applied} capítulo(s).`);
    setLvOpen(false);
    loadChapters(selectedBook.id);
  };

  const loadBooks = async () => {
    const { data } = await tbl("books").select("*").order("display_order");
    setBooks((data as Book[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadBooks(); }, []);

  const loadChapters = async (bookId: string) => {
    const { data } = await tbl("book_chapters").select("*").eq("book_id", bookId).order("chapter_index");
    setChapters((data as Chapter[]) ?? []);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books
      .filter((b) => levelFilter === "all" || b.level === levelFilter)
      .filter((b) => categoryFilter === "all" || b.category === categoryFilter)
      .filter((b) => !q || b.title.toLowerCase().includes(q) || (b.author ?? "").toLowerCase().includes(q));
  }, [books, search, levelFilter, categoryFilter]);

  const openBookDialog = (b?: Book) => {
    setEditingBook(b ?? null);
    setForm(
      b
        ? {
            title: b.title,
            author: b.author ?? "",
            description: b.description ?? "",
            level: b.level,
            category: b.category,
            cover_url: b.cover_url ?? "",
            published: b.published,
            display_order: b.display_order,
          }
        : { ...emptyBook, display_order: books.length },
    );
    setBookOpen(true);
  };

  const saveBook = async () => {
    if (!form.title.trim()) { toast.error("Informe o título."); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      description: form.description.trim() || null,
      level: form.level,
      category: form.category,
      cover_url: form.cover_url.trim() || null,
      published: form.published,
      display_order: Number(form.display_order) || 0,
    };
    const { error } = editingBook
      ? await tbl("books").update(payload).eq("id", editingBook.id)
      : await tbl("books").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Livro salvo.");
    setBookOpen(false);
    loadBooks();
  };

  const deleteBook = async (b: Book) => {
    if (!confirm(`Excluir "${b.title}" e seus capítulos?`)) return;
    const { error } = await tbl("books").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Livro excluído.");
    if (selectedBook?.id === b.id) setSelectedBook(null);
    loadBooks();
  };

  const openChapterDialog = async (c?: Chapter) => {
    setEditingChapter(c ?? null);
    setChapterForm(
      c
        ? { title: c.title, chapter_index: c.chapter_index, content: c.content, audio_url: c.audio_url ?? "" }
        : { title: "", chapter_index: chapters.length + 1, content: "", audio_url: "" },
    );
    if (c) {
      const [{ data: g }, { data: q }] = await Promise.all([
        tbl("book_glossary").select("*").eq("chapter_id", c.id),
        tbl("book_quizzes").select("*").eq("chapter_id", c.id).order("display_order"),
      ]);
      setGlossary(
        ((g as any[]) ?? []).map((r) => ({ id: r.id, term: r.term, definition: r.definition, example: r.example ?? "" })),
      );
      setQuestions(
        ((q as any[]) ?? []).map((r) => ({
          id: r.id,
          question_text: r.question_text,
          options: Array.isArray(r.options) ? r.options : ["", "", ""],
          correct_option_index: r.correct_option_index,
          display_order: r.display_order,
        })),
      );
    } else {
      setGlossary([]);
      setQuestions([]);
    }
    setChapterOpen(true);
  };

  const saveChapter = async () => {
    if (!selectedBook) return;
    if (!chapterForm.title.trim()) { toast.error("Informe o título do capítulo."); return; }
    setSaving(true);
    const payload = {
      book_id: selectedBook.id,
      title: chapterForm.title.trim(),
      chapter_index: Number(chapterForm.chapter_index) || 1,
      content: chapterForm.content,
      audio_url: chapterForm.audio_url.trim() || null,
    };
    let chapterId = editingChapter?.id;
    if (editingChapter) {
      const { error } = await tbl("book_chapters").update(payload).eq("id", editingChapter.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await tbl("book_chapters").insert(payload).select("id").single();
      if (error) { setSaving(false); toast.error(error.message); return; }
      chapterId = (data as { id: string }).id;
    }

    // Reescreve glossário e perguntas do capítulo.
    await tbl("book_glossary").delete().eq("chapter_id", chapterId);
    const gRows = glossary
      .filter((g) => g.term.trim() && g.definition.trim())
      .map((g) => ({
        chapter_id: chapterId,
        term: g.term.trim(),
        definition: g.definition.trim(),
        example: g.example.trim() || null,
      }));
    if (gRows.length) await tbl("book_glossary").insert(gRows);

    await tbl("book_quizzes").delete().eq("chapter_id", chapterId);
    const qRows = questions
      .filter((q) => q.question_text.trim() && q.options.filter((o) => o.trim()).length >= 2)
      .map((q, i) => ({
        chapter_id: chapterId,
        question_text: q.question_text.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        correct_option_index: q.correct_option_index,
        display_order: i,
      }));
    if (qRows.length) await tbl("book_quizzes").insert(qRows);

    setSaving(false);
    toast.success("Capítulo salvo.");
    setChapterOpen(false);
    loadChapters(selectedBook.id);
  };

  const deleteChapter = async (c: Chapter) => {
    if (!confirm(`Excluir o capítulo "${c.title}"?`)) return;
    const { error } = await tbl("book_chapters").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Capítulo excluído.");
    if (selectedBook) loadChapters(selectedBook.id);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ------- CHAPTERS OF A BOOK -------
  if (selectedBook) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Livros
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openLibrivox("bulk")}>
              <Headphones className="h-4 w-4 mr-1.5" /> Buscar narração (LibriVox)
            </Button>
            <Button size="sm" onClick={() => openChapterDialog()}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo capítulo
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold">{selectedBook.title}</h2>
          <p className="text-sm text-muted-foreground">
            {selectedBook.level} • {selectedBook.category}
          </p>
        </div>

        {chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum capítulo cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {chapters.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Badge variant="secondary">{c.chapter_index}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.content.length} caracteres {c.audio_url ? "• com áudio" : "• sem áudio"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openChapterDialog(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteChapter(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={chapterOpen} onOpenChange={setChapterOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingChapter ? "Editar capítulo" : "Novo capítulo"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={chapterForm.title} onChange={(e) => setChapterForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={chapterForm.chapter_index}
                    onChange={(e) => setChapterForm((f) => ({ ...f, chapter_index: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Áudio da narração (URL mp3)</Label>
                <div className="flex gap-2">
                  <Input
                    value={chapterForm.audio_url}
                    onChange={(e) => setChapterForm((f) => ({ ...f, audio_url: e.target.value }))}
                    placeholder="https://..."
                  />
                  <Button type="button" variant="outline" onClick={() => openLibrivox("chapter")}>
                    <Headphones className="h-4 w-4 mr-1.5" /> LibriVox
                  </Button>
                </div>
                {chapterForm.audio_url && (
                  <audio src={chapterForm.audio_url} controls preload="none" className="w-full mt-1" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Texto do conto/capítulo</Label>
                <Textarea
                  rows={12}
                  value={chapterForm.content}
                  onChange={(e) => setChapterForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Cole o texto. Separe os parágrafos com uma linha em branco."
                />
              </div>

              {/* Glossário (click-to-define) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Palavras destacadas (Click-to-Define)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setGlossary((g) => [...g, { term: "", definition: "", example: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Palavra
                  </Button>
                </div>
                {glossary.map((g, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_1.5fr_auto] items-start">
                    <Input
                      placeholder="Palavra"
                      value={g.term}
                      onChange={(e) => setGlossary((arr) => arr.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))}
                    />
                    <Input
                      placeholder="Definição simples"
                      value={g.definition}
                      onChange={(e) => setGlossary((arr) => arr.map((x, j) => (j === i ? { ...x, definition: e.target.value } : x)))}
                    />
                    <Input
                      placeholder="Exemplo de uso"
                      value={g.example}
                      onChange={(e) => setGlossary((arr) => arr.map((x, j) => (j === i ? { ...x, example: e.target.value } : x)))}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setGlossary((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Comprehension Quiz */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Comprehension Quiz (3 perguntas)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setQuestions((q) => [
                        ...q,
                        { question_text: "", options: ["", "", ""], correct_option_index: 0, display_order: q.length },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Pergunta
                  </Button>
                </div>
                {questions.map((q, qi) => (
                  <Card key={qi}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Pergunta ${qi + 1}`}
                          value={q.question_text}
                          onChange={(e) =>
                            setQuestions((arr) => arr.map((x, j) => (j === qi ? { ...x, question_text: e.target.value } : x)))
                          }
                        />
                        <Button variant="ghost" size="icon" onClick={() => setQuestions((arr) => arr.filter((_, j) => j !== qi))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={q.correct_option_index === oi ? "default" : "outline"}
                            onClick={() =>
                              setQuestions((arr) => arr.map((x, j) => (j === qi ? { ...x, correct_option_index: oi } : x)))
                            }
                          >
                            {String.fromCharCode(65 + oi)}
                          </Button>
                          <Input
                            placeholder={`Alternativa ${String.fromCharCode(65 + oi)}`}
                            value={opt}
                            onChange={(e) =>
                              setQuestions((arr) =>
                                arr.map((x, j) =>
                                  j === qi ? { ...x, options: x.options.map((o, k) => (k === oi ? e.target.value : o)) } : x,
                                ),
                              )
                            }
                          />
                          {q.options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setQuestions((arr) =>
                                  arr.map((x, j) =>
                                    j === qi
                                      ? {
                                          ...x,
                                          options: x.options.filter((_, k) => k !== oi),
                                          correct_option_index: Math.min(x.correct_option_index, x.options.length - 2),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setQuestions((arr) => arr.map((x, j) => (j === qi ? { ...x, options: [...x.options, ""] } : x)))
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" /> Alternativa
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChapterOpen(false)}>Cancelar</Button>
              <Button onClick={saveChapter} disabled={saving}>Salvar capítulo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ------- BOOKS LIST -------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-primary" /> Livros e audio-livros
        </h2>
        <Button size="sm" onClick={() => openBookDialog()}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo livro
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título ou autor" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
        <p className="text-sm text-muted-foreground">Nenhum livro cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-14 w-11 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {b.cover_url ? (
                    <img src={b.cover_url} alt={`Capa de ${b.title}`} className="h-full w-full object-cover" />
                  ) : (
                    <BookMarked className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{b.level}</Badge>
                    <span className="text-xs text-muted-foreground truncate">{b.category}</span>
                    {!b.published && <Badge variant="outline">rascunho</Badge>}
                  </div>
                  <p className="font-medium truncate">{b.title}</p>
                  {b.author && <p className="text-xs text-muted-foreground truncate">{b.author}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedBook(b); loadChapters(b.id); }}
                >
                  Capítulos
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openBookDialog(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteBook(b)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBook ? "Editar livro" : "Novo livro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Autor</Label>
              <Input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nível</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BOOK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Capa (URL)</Label>
              <Input value={form.cover_url} onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
                <Label>Publicado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookOpen(false)}>Cancelar</Button>
            <Button onClick={saveBook} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
