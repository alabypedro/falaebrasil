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
import { Plus, Pencil, Trash2, HelpCircle, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Quiz { id: string; lesson_id: string | null; bst_product_id?: string | null; level?: string | null; display_order?: number | null; unit?: number | null; title: string; passing_score: number; lessons?: { title: string; module_id?: string; modules?: { id?: string; title: string } | null } | null; }
interface Question { id?: string; quiz_id?: string; question_text: string; options: string[]; correct_option_index: number; display_order: number; }
interface LessonOption { id: string; title: string; module_id: string; module_title: string; }
interface ModuleOption { id: string; title: string; course_title: string; }
interface BstOption { id: string; title: string }

import { LEVELS } from "@/lib/levels";

const emptyQuizForm = {
  owner: "lesson" as "lesson" | "bst",
  lesson_id: "",
  bst_product_id: "",
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
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterLesson, setFilterLesson] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [form, setForm] = useState(emptyQuizForm);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [{ data: qz }, { data: lsn }, { data: mods }, { data: bst }] = await Promise.all([
      supabase.from("quizzes").select("*, lessons(title, module_id, modules(id, title))").order("created_at"),
      supabase.from("lessons").select("id, title, module_id, modules(title)").order("display_order"),
      supabase.from("modules").select("id, title, courses(title)").order("display_order"),
      supabase.from("bst_products").select("id, title").order("display_order"),
    ]);
    if (qz) setQuizzes(qz);
    if (lsn) setLessons(lsn.map((l: any) => ({ id: l.id, title: l.title, module_id: l.module_id, module_title: l.modules?.title ?? "" })));
    if (mods) setModules(mods.map((m: any) => ({ id: m.id, title: m.title, course_title: m.courses?.title ?? "" })));
    if (bst) setBstProducts(bst as BstOption[]);
  };

  useEffect(() => { load(); }, []);

  const lessonsForFilter = filterModule === "all" ? lessons : lessons.filter((l) => l.module_id === filterModule);

  const filtered = quizzes.filter((q) => {
    if (filterLesson !== "all") return q.lesson_id === filterLesson;
    if (filterModule !== "all") return (q.lessons as any)?.modules?.id === filterModule || (q.lessons as any)?.module_id === filterModule;
    return true;
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyQuizForm, lesson_id: lessons[0]?.id ?? "", bst_product_id: bstProducts[0]?.id ?? "" });
    setQuestions([{ question_text: "", options: ["", "", "", ""], correct_option_index: 0, display_order: 0 }]);
    setOpen(true);
  };

  const openEdit = async (q: Quiz) => {
    setEditing(q);
    setForm({
      owner: q.bst_product_id ? "bst" : "lesson",
      lesson_id: q.lesson_id ?? "",
      bst_product_id: q.bst_product_id ?? "",
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

  const save = async () => {
    const isBst = form.owner === "bst";
    if (!form.title.trim() || (isBst ? !form.bst_product_id : !form.lesson_id)) {
      toast.error(isBst ? "Preencha título e produto BST" : "Preencha título e lição");
      return;
    }
    if (questions.some((q) => !q.question_text.trim() || q.options.some((o) => !o.trim()))) {
      toast.error("Preencha todas as perguntas e opções"); return;
    }
    setLoading(true);

    let quizId = editing?.id;
    const payload: Record<string, any> = {
      lesson_id: isBst ? null : form.lesson_id,
      bst_product_id: isBst ? form.bst_product_id : null,
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
        <div className="flex gap-2 flex-wrap">
          <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setFilterLesson("all"); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.course_title} › {m.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLesson} onValueChange={setFilterLesson}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por lição" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lições</SelectItem>
              {lessonsForFilter.map((l) => <SelectItem key={l.id} value={l.id}>{l.module_title} › {l.title}</SelectItem>)}
            </SelectContent>
          </Select>
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
                  {q.bst_product_id
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
                <Select value={form.owner} onValueChange={(v: "lesson" | "bst") => setForm({ ...form, owner: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lesson">Lição de curso</SelectItem>
                    <SelectItem value="bst">Produto BST</SelectItem>
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
                <Select value={form.lesson_id} onValueChange={(v) => setForm({ ...form, lesson_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.module_title} › {l.title}</SelectItem>)}</SelectContent>
                </Select>
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
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground">Selecione o rádio da alternativa correta.</p>
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
