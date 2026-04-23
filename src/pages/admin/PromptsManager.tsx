import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Mic, Trash2 } from "lucide-react";

interface Course { id: string; title: string; }

interface LessonRow {
  id: string;
  title: string;
  practice_text: string | null;
  display_order: number;
  module_id: string;
  modules?: { id: string; title: string; display_order: number; course_id: string; courses?: { id: string; title: string } | null } | null;
}

export default function PromptsManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<LessonRow | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: ls }] = await Promise.all([
      supabase.from("courses").select("id, title").order("display_order"),
      supabase
        .from("lessons")
        .select("id, title, practice_text, display_order, module_id, modules(id, title, display_order, course_id, courses(id, title))")
        .order("display_order"),
    ]);
    const courseList = (cs as Course[]) || [];
    setCourses(courseList);
    setLessons((ls as any) || []);
    setActiveCourseId((prev) => prev || courseList[0]?.id || "");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Only lessons that belong to the active course
  const lessonsInCourse = useMemo(() => {
    if (!activeCourseId) return [];
    return lessons
      .filter((l) => l.modules?.course_id === activeCourseId)
      .sort((a, b) => {
        const ma = a.modules?.display_order ?? 0;
        const mb = b.modules?.display_order ?? 0;
        if (ma !== mb) return ma - mb;
        return (a.display_order ?? 0) - (b.display_order ?? 0);
      });
  }, [lessons, activeCourseId]);

  const totalWithText = lessonsInCourse.filter((l) => l.practice_text && l.practice_text.trim()).length;

  const openEdit = (l: LessonRow) => {
    setEditing(l);
    setEditText(l.practice_text ?? "");
  };

  const saveText = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("lessons")
      .update({ practice_text: editText.trim() || null })
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Texto do AI Falaê atualizado.");
    setEditing(null);
    load();
  };

  const clearText = async (lessonId: string) => {
    const { error } = await supabase.from("lessons").update({ practice_text: null }).eq("id", lessonId);
    if (error) { toast.error(error.message); return; }
    toast.success("Texto removido da lição.");
    load();
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId);

  return (
    <div className="space-y-6">
      {/* Header / Painel direto do AI Falaê */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4 text-primary" />
            Textos do AI Falaê
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <p className="text-sm text-muted-foreground">
            Cadastre aqui as frases que o aluno lerá em voz alta no <strong>AI Falaê</strong>.
            Cada texto fica vinculado a uma lição do curso e é avaliado pelo Azure quando o aluno grava.
          </p>
          <p className="text-xs text-muted-foreground">
            Selecione um curso para ver e editar apenas os textos das lições dele.
          </p>
        </CardContent>
      </Card>

      {/* Course selector toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Curso ativo</span>
          <Select value={activeCourseId} onValueChange={setActiveCourseId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Selecione um curso" />
            </SelectTrigger>
            <SelectContent>
              {courses.length === 0 && <SelectItem value="none" disabled>Nenhum curso cadastrado</SelectItem>}
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeCourse && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{lessonsInCourse.length} lição(ões)</Badge>
            <Badge variant="outline">{totalWithText} com texto</Badge>
          </div>
        )}
      </div>

      {/* Lessons list of the active course */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Lição</TableHead>
              <TableHead>Texto para Prática de Voz</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : !activeCourseId ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Selecione um curso acima.</TableCell></TableRow>
            ) : lessonsInCourse.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Este curso ainda não tem lições. Crie-as em "Lições".</TableCell></TableRow>
            ) : lessonsInCourse.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="align-top">
                  <div className="font-medium text-sm leading-tight">{l.title}</div>
                  {l.modules?.title && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">Módulo: {l.modules.title}</div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {l.practice_text && l.practice_text.trim() ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">{l.practice_text}</p>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Nenhum texto cadastrado para esta lição.</span>
                  )}
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)} aria-label="Editar texto">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {l.practice_text && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Remover texto">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover texto desta lição?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A lição continuará existindo, mas não terá mais texto de prática no AI Falaê.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => clearText(l.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Texto do AI Falaê</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <div><strong>Lição:</strong> {editing.title}</div>
                {editing.modules?.title && <div><strong>Módulo:</strong> {editing.modules.title}</div>}
                {editing.modules?.courses?.title && <div><strong>Curso:</strong> {editing.modules.courses.title}</div>}
              </div>
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={6}
                placeholder="Texto em inglês que o aluno lerá em voz alta no AI Falaê desta lição…"
              />
              <p className="text-[11px] text-muted-foreground">
                Este texto é enviado ao Azure como referência para calcular as notas de pronúncia, fluência, prosódia e completude.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveText} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
