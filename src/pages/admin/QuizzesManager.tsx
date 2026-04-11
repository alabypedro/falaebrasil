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

interface Quiz { id: string; lesson_id: string; title: string; passing_score: number; lessons?: { title: string; modules?: { title: string } | null } | null; }
interface Question { id?: string; quiz_id?: string; question_text: string; options: string[]; correct_option_index: number; display_order: number; }
interface LessonOption { id: string; title: string; module_title: string; }

const emptyQuizForm = { lesson_id: "", title: "", passing_score: 70 };

export default function QuizzesManager() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [form, setForm] = useState(emptyQuizForm);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [{ data: qz }, { data: lsn }] = await Promise.all([
      supabase.from("quizzes").select("*, lessons(title, modules(title))").order("created_at"),
      supabase.from("lessons").select("id, title, modules(title)").order("display_order"),
    ]);
    if (qz) setQuizzes(qz);
    if (lsn) setLessons(lsn.map((l: any) => ({ id: l.id, title: l.title, module_title: l.modules?.title ?? "" })));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyQuizForm, lesson_id: lessons[0]?.id ?? "" });
    setQuestions([{ question_text: "", options: ["", "", "", ""], correct_option_index: 0, display_order: 0 }]);
    setOpen(true);
  };

  const openEdit = async (q: Quiz) => {
    setEditing(q);
    setForm({ lesson_id: q.lesson_id, title: q.title, passing_score: q.passing_score });
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
    if (!form.title.trim() || !form.lesson_id) { toast.error("Preencha título e lição"); return; }
    if (questions.some((q) => !q.question_text.trim() || q.options.some((o) => !o.trim()))) {
      toast.error("Preencha todas as perguntas e opções"); return;
    }
    setLoading(true);

    let quizId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("quizzes").update({ lesson_id: form.lesson_id, title: form.title.trim(), passing_score: form.passing_score }).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      // Delete old questions and re-insert
      await supabase.from("quiz_questions").delete().eq("quiz_id", editing.id);
    } else {
      const { data, error } = await supabase.from("quizzes").insert({ lesson_id: form.lesson_id, title: form.title.trim(), passing_score: form.passing_score }).select("id").single();
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quizzes</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Quiz</Button>
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
            {quizzes.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum quiz cadastrado.</TableCell></TableRow>
            )}
            {quizzes.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{(q.lessons as any)?.title ?? "—"}</TableCell>
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
                <Label>Lição</Label>
                <Select value={form.lesson_id} onValueChange={(v) => setForm({ ...form, lesson_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.module_title} › {l.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nota Mínima (%)</Label>
                <Input type="number" min={0} max={100} value={form.passing_score} onChange={(e) => setForm({ ...form, passing_score: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
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
