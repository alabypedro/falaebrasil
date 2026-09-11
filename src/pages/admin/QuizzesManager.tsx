import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, HelpCircle, X, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Quiz { id: string; lesson_id: string | null; bst_product_id?: string | null; book_text_id?: string | null; level?: string | null; display_order?: number | null; unit?: number | null; title: string; passing_score: number; lessons?: { title: string; module_id?: string; modules?: { id?: string; title: string } | null } | null; }
interface Question { id?: string; quiz_id?: string; question_text: string; options: string[]; correct_option_index: number; display_order: number; }
interface LessonOption { id: string; title: string; module_id: string; module_order: number; module_title: string; course_id: string; course_title: string; course_level: string; display_order: number; }
interface ModuleOption { id: string; title: string; display_order: number; course_id: string; course_title: string; course_level: string; }
interface BstOption { id: string; title: string }
interface BookTextOption { id: string; title: string; level: string; display_order: number }

import { LEVELS } from "@/lib/levels";
import { SearchableSelect, type SearchableOption } from "@/components/admin/SearchableSelect";
import { compareCourses, courseLabel, segmentGroupOf, SEGMENT_GROUP_ORDER } from "@/lib/courseOrder";
import { useMemo } from "react";

const emptyQuizForm = {
  owner: "lesson" as "lesson" | "bst" | "book",
  lesson_id: "",
  bst_product_id: "",
  book_text_id: "",
  level: "A1",
  display_order: 0,
  unit: "none",
  title: "",
  passing_score: 70,
};

export default function QuizzesManager() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [bstProducts, setBstProducts] = useState<BstOption[]>([]);
  const [bookTexts, setBookTexts] = useState<BookTextOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterLesson, setFilterLesson] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [form, setForm] = useState(emptyQuizForm);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [{ data: qz }, { data: lsn }, { data: mods }, { data: bst }, { data: bks }] = await Promise.all([
      supabase.from("quizzes").select("*, lessons(title, module_id, modules(id, title, course_id, courses(title)))").order("created_at"),
      supabase.from("lessons").select("id, title, display_order, module_id, modules(title, display_order, course_id, courses(title, level))").order("display_order"),
      supabase.from("modules").select("id, title, display_order, course_id, courses(title, level)").order("display_order"),
      supabase.from("bst_products").select("id, title").order("display_order"),
      supabase.from("book_texts" as any).select("id, title, level, display_order").order("level").order("display_order"),
    ]);
    if (bks) setBookTexts(bks as unknown as BookTextOption[]);
    if (qz) setQuizzes(qz);
    if (lsn) setLessons(lsn.map((l: any) => ({
      id: l.id, title: l.title, display_order: l.display_order ?? 0, module_id: l.module_id,
      module_order: l.modules?.display_order ?? 0, module_title: l.modules?.title ?? "",
      course_id: l.modules?.course_id ?? "", course_title: l.modules?.courses?.title ?? "", course_level: l.modules?.courses?.level ?? "",
    })));
    if (mods) setModules(mods.map((m: any) => ({
      id: m.id, title: m.title, display_order: m.display_order ?? 0, course_id: m.course_id ?? "",
      course_title: m.courses?.title ?? "", course_level: m.courses?.level ?? "",
    })));
    if (bst) setBstProducts(bst as BstOption[]);
  };

  useEffect(() => { load(); }, []);

  const courseOf = (x: { course_id?: string; course_title?: string; course_level?: string }) => ({
    id: x.course_id ?? "", title: x.course_title ?? "", level: x.course_level ?? "",
  });

  const courseOptions: SearchableOption[] = useMemo(() => {
    const map = new Map<string, { id: string; title: string; level: string }>();
    modules.forEach((m) => { if (m.course_id && !map.has(m.course_id)) map.set(m.course_id, courseOf(m)); });
    const courseOpts = [...map.values()]
      .sort(compareCourses)
      .map((c) => ({ value: c.id, label: courseLabel(c), group: segmentGroupOf(c), keywords: `${c.title} ${c.level}` }));
    const bstOpts: SearchableOption[] = bstProducts.map((b) => ({
      value: `bst:${b.id}`,
      label: `BST: ${b.title}`,
      group: "BST",
      keywords: `bst ${b.title}`,
    }));
    const bookOpts: SearchableOption[] = bookTexts.map((b) => ({
      value: `book:${b.id}`,
      label: `Estórias Curtas: ${b.level} › ${b.title}`,
      group: "Estórias Curtas",
      keywords: `estorias curtas livros ${b.level} ${b.title}`,
    }));
    return [...courseOpts, ...bstOpts, ...bookOpts];
  }, [modules, bstProducts, bookTexts]);

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => compareCourses(courseOf(a), courseOf(b)) || a.display_order - b.display_order || a.title.localeCompare(b.title, "pt-BR", { numeric: true })),
    [modules]
  );

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) =>
      compareCourses(courseOf(a), courseOf(b)) || a.module_order - b.module_order || a.display_order - b.display_order ||
      a.title.localeCompare(b.title, "pt-BR", { numeric: true })),
    [lessons]
  );

  const moduleOptions: SearchableOption[] = useMemo(
    () => sortedModules
      .filter((m) => filterCourse === "all" || m.course_id === filterCourse)
      .map((m) => ({ value: m.id, label: `${courseLabel(courseOf(m))} › ${m.title}`, group: segmentGroupOf(courseOf(m)), keywords: `${m.course_title} ${m.course_level} ${m.title}` })),
    [sortedModules, filterCourse]
  );

  const lessonOptionsFor = (mods: string, course: string): SearchableOption[] =>
    sortedLessons
      .filter((l) => (course === "all" || l.course_id === course) && (mods === "all" || l.module_id === mods))
      .map((l) => ({
        value: l.id,
        label: `${courseLabel(courseOf(l))} › ${l.module_title} › ${l.title}`,
        group: segmentGroupOf(courseOf(l)),
        keywords: `${l.course_title} ${l.course_level} ${l.module_title} ${l.title}`,
      }));

  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const bstFilter = filterCourse.startsWith("bst:") ? filterCourse.slice(4) : null;
    const bookFilter = filterCourse.startsWith("book:") ? filterCourse.slice(5) : null;
    return quizzes
      .filter((qz) => {
        const l = qz.lesson_id ? lessonById.get(qz.lesson_id) : undefined;
        const bstTitle = qz.bst_product_id ? bstProducts.find((b) => b.id === qz.bst_product_id)?.title ?? "" : "";
        const bookTitle = qz.book_text_id ? bookTexts.find((b) => b.id === qz.book_text_id)?.title ?? "" : "";
        if (q && !(qz.title.toLowerCase().includes(q) || (l?.title ?? "").toLowerCase().includes(q) || (l?.course_title ?? "").toLowerCase().includes(q) || bstTitle.toLowerCase().includes(q) || bookTitle.toLowerCase().includes(q))) return false;
        if (bstFilter) return qz.bst_product_id === bstFilter;
        if (bookFilter) return qz.book_text_id === bookFilter;
        if (filterLesson !== "all") return qz.lesson_id === filterLesson;
        if (filterModule !== "all") return (qz.lessons as any)?.modules?.id === filterModule || (qz.lessons as any)?.module_id === filterModule;
        if (filterCourse !== "all") return l?.course_id === filterCourse;
        return true;
      })
      .sort((a, b) => {
        const la = a.lesson_id ? lessonById.get(a.lesson_id) : undefined;
        const lb = b.lesson_id ? lessonById.get(b.lesson_id) : undefined;
        if (!la && lb) return 1;
        if (la && !lb) return -1;
        if (la && lb) {
          const c = compareCourses(courseOf(la), courseOf(lb));
          if (c !== 0) return c;
          if (la.module_order !== lb.module_order) return la.module_order - lb.module_order;
          if (la.display_order !== lb.display_order) return la.display_order - lb.display_order;
        }
        return a.title.localeCompare(b.title, "pt-BR", { numeric: true });
      });
  }, [quizzes, searchQuery, filterCourse, filterModule, filterLesson, lessonById, bstProducts, bookTexts]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyQuizForm, lesson_id: lessons[0]?.id ?? "", bst_product_id: bstProducts[0]?.id ?? "", book_text_id: "" });
    setQuestions([{ question_text: "", options: ["", "", "", ""], correct_option_index: 0, display_order: 0 }]);
    setOpen(true);
  };

  const openEdit = async (q: Quiz) => {
    setEditing(q);
    setForm({
      owner: q.book_text_id ? "book" : q.bst_product_id ? "bst" : "lesson",
      lesson_id: q.lesson_id ?? "",
      bst_product_id: q.bst_product_id ?? "",
      book_text_id: q.book_text_id ?? "",
      level: q.level ?? "A1",
      display_order: q.display_order ?? 0,
      unit: q.unit ? String(q.unit) : "none",
      title: q.title,
      passing_score: q.passing_score,
    });
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", q.id).order("display_order");
    setQuestions(data?.map((d: any) => ({ ...d, options: d.options as string[] })) ?? []);
    setOpen(true);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question_text: "", options: ["", "", "", ""], correct_option_index: 0, display_order: questions.length }]);
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[idx] as any)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    updated[qIdx] = { ...updated[qIdx], options: [...updated[qIdx].options, ""] };
    setQuestions(updated);
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    const q = updated[qIdx];
    if (q.options.length <= 2) { toast.error("Mínimo de 2 alternativas"); return; }
    const options = q.options.filter((_, i) => i !== oIdx);
    let correct = q.correct_option_index;
    if (correct === oIdx) correct = 0;
    else if (correct > oIdx) correct -= 1;
    updated[qIdx] = { ...q, options, correct_option_index: correct };
    setQuestions(updated);
  };

  const save = async () => {
    const isBst = form.owner === "bst";
    const isBook = form.owner === "book";
    const missing = isBst ? !form.bst_product_id : isBook ? !form.book_text_id : !form.lesson_id;
    if (!form.title.trim() || missing) {
      toast.error(isBst ? "Preencha título e produto BST" : isBook ? "Preencha título e estória curta" : "Preencha título e lição");
      return;
    }
    if (questions.some((q) => !q.question_text.trim() || q.options.some((o) => !o.trim()))) {
      toast.error("Preencha todas as perguntas e opções"); return;
    }
    setLoading(true);

    let quizId = editing?.id;
    const payload: Record<string, any> = {
      lesson_id: isBst || isBook ? null : form.lesson_id,
      bst_product_id: isBst ? form.bst_product_id : null,
      book_text_id: isBook ? form.book_text_id : null,
      level: form.level,
      display_order: Number(form.display_order) || 0,
      unit: form.unit === "none" ? null : parseInt(form.unit, 10),
      title: form.title.trim(),
      passing_score: form.passing_score,
    };

    if (editing) {
      const { error } = await supabase.from("quizzes").update(payload as any).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      // Delete old questions and re-insert
      await supabase.from("quiz_questions").delete().eq("quiz_id", editing.id);
    } else {
      const { data, error } = await supabase.from("quizzes").insert(payload as any).select("id").single();
      if (error || !data) { toast.error(error?.message ?? "Erro"); setLoading(false); return; }
      quizId = data.id;
    }

    // Insert questions
    const questionsPayload = questions.map((q, i) => ({
      quiz_id: quizId!,
      question_text: q.question_text.trim(),
      options: q.options,
      correct_option_index: q.correct_option_index,
      display_order: i,
    }));

    const { error: qError } = await supabase.from("quiz_questions").insert(questionsPayload);
    if (qError) { toast.error(qError.message); setLoading(false); return; }

    toast.success(editing ? "Quiz atualizado!" : "Quiz criado!");
    setOpen(false); setLoading(false); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Quiz excluído"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Quizzes</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar quiz..." className="pl-9 h-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="w-48">
            <SearchableSelect
              value={filterCourse}
              onChange={(v) => { setFilterCourse(v); setFilterModule("all"); setFilterLesson("all"); }}
              groupOrder={SEGMENT_GROUP_ORDER}
              searchPlaceholder="Buscar curso..."
              options={[{ value: "all", label: "Todos os cursos" }, ...courseOptions]}
            />
          </div>
          <div className="w-56">
            <SearchableSelect
              value={filterModule}
              onChange={(v) => { setFilterModule(v); setFilterLesson("all"); }}
              groupOrder={SEGMENT_GROUP_ORDER}
              searchPlaceholder="Buscar módulo..."
              options={[{ value: "all", label: "Todos os módulos" }, ...moduleOptions]}
            />
          </div>
          <div className="w-56">
            <SearchableSelect
              value={filterLesson}
              onChange={setFilterLesson}
              groupOrder={SEGMENT_GROUP_ORDER}
              searchPlaceholder="Buscar lição..."
              options={[{ value: "all", label: "Todas as lições" }, ...lessonOptionsFor(filterModule, filterCourse)]}
            />
          </div>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Quiz</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Lição</TableHead>
              <TableHead>Nota Mínima</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum quiz cadastrado.</TableCell></TableRow>
            )}
            {filtered.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {q.book_text_id
                    ? `Estória Curta: ${bookTexts.find((b) => b.id === q.book_text_id)?.title ?? "—"}`
                    : q.bst_product_id
                    ? `BST: ${bstProducts.find((b) => b.id === q.bst_product_id)?.title ?? "—"}`
                    : (q.lessons as any)?.title ?? "—"}
                </TableCell>
                <TableCell>{q.passing_score}%</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir quiz?</AlertDialogTitle><AlertDialogDescription>Perguntas e tentativas serão excluídas.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(q.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Quiz" : "Novo Quiz"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vínculo</Label>
                <Select value={form.owner} onValueChange={(v: "lesson" | "bst" | "book") => setForm({ ...form, owner: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lesson">Lição de curso</SelectItem>
                    <SelectItem value="bst">Produto BST</SelectItem>
                    <SelectItem value="book">Estórias Curtas (IA Leiaê)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nota Mínima (%)</Label>
                <Input type="number" min={0} max={100} value={form.passing_score} onChange={(e) => setForm({ ...form, passing_score: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            {form.owner === "lesson" ? (
              <div className="space-y-2">
                <Label>Lição</Label>
                <SearchableSelect
                  value={form.lesson_id}
                  onChange={(v) => setForm({ ...form, lesson_id: v })}
                  placeholder="Selecione curso › módulo › lição"
                  searchPlaceholder="Buscar por curso, módulo ou lição..."
                  groupOrder={SEGMENT_GROUP_ORDER}
                  options={lessonOptionsFor("all", "all")}
                />
              </div>
            ) : form.owner === "book" ? (
              <div className="space-y-2">
                <Label>Estória Curta (IA Leiaê)</Label>
                <SearchableSelect
                  value={form.book_text_id}
                  onChange={(v) => {
                    const bt = bookTexts.find((b) => b.id === v);
                    setForm({ ...form, book_text_id: v, level: bt?.level ?? form.level });
                  }}
                  placeholder="Selecione a estória curta"
                  searchPlaceholder="Buscar por nível ou título..."
                  options={bookTexts.map((b) => ({
                    value: b.id,
                    label: `${b.level} › ${b.title}`,
                    group: b.level,
                    keywords: `${b.level} ${b.title}`,
                  }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  O quiz aparece para o aluno na página Estórias Curtas, junto do texto escolhido.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-1 sm:col-span-1">
                  <Label>Produto BST</Label>
                  <Select value={form.bst_product_id} onValueChange={(v) => setForm({ ...form, bst_product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{bstProducts.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nível</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{lv}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Unidade (Unit 1–12)</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((u) => (
                        <SelectItem key={u} value={String(u)}>Unit {u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Título do Quiz</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Perguntas ({questions.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
              </div>

              {questions.map((q, qIdx) => (
                <Card key={qIdx}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Pergunta {qIdx + 1}</CardTitle>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuestion(qIdx)}><X className="h-3 w-3" /></Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={q.question_text} onChange={(e) => updateQuestion(qIdx, "question_text", e.target.value)} placeholder="Texto da pergunta..." />
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correct_option_index === oIdx}
                            onChange={() => updateQuestion(qIdx, "correct_option_index", oIdx)}
                            className="accent-primary"
                          />
                           <Input value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Opção ${oIdx + 1}`} className="flex-1" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            disabled={q.options.length <= 2}
                            onClick={() => removeOption(qIdx, oIdx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground">Selecione o rádio da alternativa correta.</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => addOption(qIdx)}>
                          <Plus className="h-3 w-3 mr-1" />Alternativa
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
