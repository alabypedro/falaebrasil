import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mic, Image as ImageIcon, MessageSquare, FileText, X, Upload, Loader2 as Spinner, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface ListeningLesson {
  id: string;
  title: string;
  description: string;
  level: string;
  content: any;
}

const emptyLesson = {
  title: "",
  description: "",
  level: "A1",
  content: {
    part1: {
      image_url: "",
      options: [
        { script: "" },
        { script: "" },
        { script: "" }
      ],
      correct_index: 0
    },
    part2: [
      { question_script: "", options: [{ script: "" }, { script: "" }, { script: "" }], correct_index: 0 },
      { question_script: "", options: [{ script: "" }, { script: "" }, { script: "" }], correct_index: 0 },
      { question_script: "", options: [{ script: "" }, { script: "" }, { script: "" }], correct_index: 0 }
    ],
    part3: {
      dialogue: [
        { speaker: "female", text: "" },
        { speaker: "male", text: "" },
        { speaker: "female", text: "" },
        { speaker: "male", text: "" }
      ],
      questions: [
        { enunciado: "", options: ["", "", ""], correct_index: 0 },
        { enunciado: "", options: ["", "", ""], correct_index: 0 },
        { enunciado: "", options: ["", "", ""], correct_index: 0 }
      ]
    },
    part4: {
      script: "",
      questions: [
        { enunciado: "", options: ["", "", ""], correct_index: 0 },
        { enunciado: "", options: ["", "", ""], correct_index: 0 },
        { enunciado: "", options: ["", "", ""], correct_index: 0 }
      ]
    }
  }
};

export default function ListeningManager() {
  const [lessons, setLessons] = useState<ListeningLesson[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListeningLesson | null>(null);
  const [form, setForm] = useState(emptyLesson);
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase.from("listening_lessons").select("*").order("created_at");
    if (data) setLessons(data);
    if (error) toast.error("Erro ao carregar lições");
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(JSON.parse(JSON.stringify(emptyLesson)));
    setOpen(true);
  };

  const openEdit = (lesson: ListeningLesson) => {
    setEditing(lesson);
    const base = JSON.parse(JSON.stringify(emptyLesson.content));
    const merged = {
      ...base,
      ...(lesson.content || {}),
      part1: { ...base.part1, ...((lesson.content && lesson.content.part1) || {}) },
      part3: { ...base.part3, ...((lesson.content && lesson.content.part3) || {}) },
      part4: { ...base.part4, ...((lesson.content && lesson.content.part4) || {}) },
    };
    setForm({
      title: lesson.title,
      description: lesson.description || "",
      level: lesson.level,
      content: merged
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Preencha o título"); return; }
    setLoading(true);

    const payload = {
      title: form.title,
      description: form.description,
      level: form.level,
      content: form.content
    };

    let error;
    if (editing) {
      const { error: e } = await supabase.from("listening_lessons").update(payload).eq("id", editing.id);
      error = e;
    } else {
      const { error: e } = await supabase.from("listening_lessons").insert(payload);
      error = e;
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editing ? "Lição atualizada!" : "Lição criada!");
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("listening_lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lição excluída"); load(); }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `listening/${fileName}`;
      const bucketName = 'lesson-files';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      updatePart1("image_url", publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const updatePart1 = (field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      content: {
        ...prev.content,
        part1: { ...prev.content.part1, [field]: value }
      }
    }));
  };

  const updatePart2 = (idx: number, field: string, value: any) => {
    const newPart2 = [...form.content.part2];
    newPart2[idx] = { ...newPart2[idx], [field]: value };
    setForm(prev => ({
      ...prev,
      content: { ...prev.content, part2: newPart2 }
    }));
  };

  const updatePart3 = (field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      content: {
        ...prev.content,
        part3: { ...prev.content.part3, [field]: value }
      }
    }));
  };

  const updatePart4 = (field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      content: {
        ...prev.content,
        part4: { ...prev.content.part4, [field]: value }
      }
    }));
  };

  const levelCounts = ["A1", "A2", "B1", "B2", "C1", "C2"].reduce((acc, lvl) => {
    acc[lvl] = lessons.filter(l => l.level === lvl).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredLessons = lessons
    .filter(l => {
      const matchesLevel = filterLevel === "all" || l.level === filterLevel;
      const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLevel && matchesSearch;
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">IA Escutaê - Gestão</h2>
          <p className="text-muted-foreground">Gerencie o catálogo de lições de compreensão auditiva.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova Lição</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {["A1", "A2", "B1", "B2", "C1", "C2"].map(lvl => (
          <Card key={lvl} className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            filterLevel === lvl ? "border-primary bg-primary/5" : ""
          )} onClick={() => setFilterLevel(filterLevel === lvl ? "all" : lvl)}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">{lvl}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{levelCounts[lvl] || 0}</span>
                <span className="text-xs text-muted-foreground">/ 12</span>
              </div>
              <Progress 
                value={((levelCounts[lvl] || 0) / 12) * 100} 
                className="h-1 mt-2" 
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por título..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Filtrar por Nível:</Label>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os níveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Mostrando <strong>{filteredLessons.length}</strong> de <strong>{lessons.length}</strong> lições
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Questões</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma lição cadastrada.</TableCell></TableRow>
            )}
            {filteredLessons.map((lesson) => (
              <TableRow key={lesson.id}>
                <TableCell className="font-medium">{lesson.title}</TableCell>
                <TableCell>{lesson.level}</TableCell>
                <TableCell>10 questões</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(lesson)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir lição?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(lesson.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Lição" : "Nova Lição"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Lesson 01 - Introductions" />
              </div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["A1", "A2", "B1", "B2", "C1", "C2"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descrição da lição" />
            </div>

            <Tabs defaultValue="part1" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="part1">Parte 1 (Foto)</TabsTrigger>
                <TabsTrigger value="part2">Parte 2 (Q&A)</TabsTrigger>
                <TabsTrigger value="part3">Parte 3 (Diálogo)</TabsTrigger>
                <TabsTrigger value="part4">Parte 4 (Dissertação)</TabsTrigger>
              </TabsList>

              <TabsContent value="part1" className="space-y-4 pt-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Descrição de Foto (1 Questão)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Imagem da Questão</Label>
                      <div className="flex flex-col gap-3">
                        {form.content.part1.image_url && (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted group">
                            <img 
                              src={form.content.part1.image_url} 
                              alt="Preview" 
                              className="w-full h-full object-cover" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => updatePart1("image_url", "")}
                                className="h-8"
                              >
                                <X className="h-4 w-4 mr-1" /> Remover
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input 
                            value={form.content.part1.image_url} 
                            onChange={(e) => updatePart1("image_url", e.target.value)} 
                            placeholder="URL da imagem ou faça upload..." 
                            className="flex-1"
                          />
                          <div>
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              disabled={isUploading}
                            />
                            <Button 
                              variant="outline" 
                              type="button" 
                              disabled={isUploading}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {isUploading ? <Spinner className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                              Upload
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>Scripts de Áudio (Apenas Narrados)</Label>
                      {form.content.part1.options.map((opt: any, i: number) => (
                        <div key={i} className="flex gap-2 items-start">
                          <input type="radio" checked={form.content.part1.correct_index === i} onChange={() => updatePart1("correct_index", i)} className="mt-3" />
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Alternativa {String.fromCharCode(65 + i)}</Label>
                            <Textarea value={opt.script} onChange={(e) => {
                              const newOpts = [...form.content.part1.options];
                              newOpts[i].script = e.target.value;
                              updatePart1("options", newOpts);
                            }} placeholder="Script para ser narrado pela IA..." />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="part2" className="space-y-4 pt-4">
                {form.content.part2.map((item: any, i: number) => (
                  <Card key={i}>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Mic className="h-4 w-4" /> Pergunta & Resposta - Questão {i + 1}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Script da Pergunta (Narrado)</Label>
                        <Textarea value={item.question_script} onChange={(e) => updatePart2(i, "question_script", e.target.value)} />
                      </div>
                      <div className="space-y-3">
                        <Label>Scripts das Respostas (Narrados)</Label>
                        {item.options.map((opt: any, oi: number) => (
                          <div key={oi} className="flex gap-2 items-start">
                            <input type="radio" checked={item.correct_index === oi} onChange={() => updatePart2(i, "correct_index", oi)} className="mt-3" />
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px] uppercase text-muted-foreground">Alternativa {String.fromCharCode(65 + oi)}</Label>
                              <Textarea value={opt.script} onChange={(e) => {
                                const newOpts = [...item.options];
                                newOpts[oi].script = e.target.value;
                                updatePart2(i, "options", newOpts);
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="part3" className="space-y-4 pt-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Mini Diálogo (3 Questões)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <Label>Scripts do Diálogo (Narrado com vozes alternadas)</Label>
                      {form.content.part3.dialogue.map((line: any, i: number) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Select value={line.speaker} onValueChange={(v) => {
                            const newLines = [...form.content.part3.dialogue];
                            newLines[i].speaker = v;
                            updatePart3("dialogue", newLines);
                          }}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="female">Feminino</SelectItem>
                              <SelectItem value="male">Masculino</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea value={line.text} onChange={(e) => {
                            const newLines = [...form.content.part3.dialogue];
                            newLines[i].text = e.target.value;
                            updatePart3("dialogue", newLines);
                          }} className="flex-1" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 border-t pt-4 mt-4">
                      <Label className="text-base">Questões de Interpretação (Publicadas)</Label>
                      {form.content.part3.questions.map((q: any, i: number) => (
                        <Card key={i} className="bg-muted/50">
                          <CardContent className="pt-4 space-y-3">
                            <div className="space-y-1">
                              <Label>Enunciado Questão {i + 1}</Label>
                              <Input value={q.enunciado} onChange={(e) => {
                                const newQs = [...form.content.part3.questions];
                                newQs[i].enunciado = e.target.value;
                                updatePart3("questions", newQs);
                              }} />
                            </div>
                            <div className="space-y-2">
                              {q.options.map((opt: string, oi: number) => (
                                <div key={oi} className="flex gap-2 items-center">
                                  <input type="radio" checked={q.correct_index === oi} onChange={() => {
                                    const newQs = [...form.content.part3.questions];
                                    newQs[i].correct_index = oi;
                                    updatePart3("questions", newQs);
                                  }} />
                                  <Input value={opt} onChange={(e) => {
                                    const newQs = [...form.content.part3.questions];
                                    newQs[i].options[oi] = e.target.value;
                                    updatePart3("questions", newQs);
                                  }} placeholder={`Opção ${String.fromCharCode(65 + oi)}`} />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="part4" className="space-y-4 pt-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Mini Dissertação (3 Questões)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Script da Dissertação (Apenas Narrado)</Label>
                      <Textarea value={form.content.part4.script} onChange={(e) => updatePart4("script", e.target.value)} rows={6} />
                    </div>

                    <div className="space-y-4 border-t pt-4 mt-4">
                      <Label className="text-base">Questões de Interpretação (Publicadas)</Label>
                      {form.content.part4.questions.map((q: any, i: number) => (
                        <Card key={i} className="bg-muted/50">
                          <CardContent className="pt-4 space-y-3">
                            <div className="space-y-1">
                              <Label>Enunciado Questão {i + 1}</Label>
                              <Input value={q.enunciado} onChange={(e) => {
                                const newQs = [...form.content.part4.questions];
                                newQs[i].enunciado = e.target.value;
                                updatePart4("questions", newQs);
                              }} />
                            </div>
                            <div className="space-y-2">
                              {q.options.map((opt: string, oi: number) => (
                                <div key={oi} className="flex gap-2 items-center">
                                  <input type="radio" checked={q.correct_index === oi} onChange={() => {
                                    const newQs = [...form.content.part4.questions];
                                    newQs[i].correct_index = oi;
                                    updatePart4("questions", newQs);
                                  }} />
                                  <Input value={opt} onChange={(e) => {
                                    const newQs = [...form.content.part4.questions];
                                    newQs[i].options[oi] = e.target.value;
                                    updatePart4("questions", newQs);
                                  }} placeholder={`Opção ${String.fromCharCode(65 + oi)}`} />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar Lição"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}