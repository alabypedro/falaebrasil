import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Video, FileText, ExternalLink, Search, Filter, Eye, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableRow } from "@/components/admin/SortableRow";
import { BulkActions } from "@/components/admin/BulkActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LessonPreview } from "@/components/admin/LessonPreview";
import { SearchableSelect, type SearchableOption } from "@/components/admin/SearchableSelect";
import { compareCourses, courseLabel, segmentGroupOf, sortCourses, SEGMENT_GROUP_ORDER } from "@/lib/courseOrder";

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  practice_text: string | null;
  display_order: number;
  modules?: { title: string; display_order?: number; courses?: { id?: string; title: string; level?: string | null } | null } | null;
}

interface ModuleOption {
  id: string;
  title: string;
  display_order: number;
  course_id: string | null;
  course_title: string;
  course_level: string;
}


interface LessonVideo {
  id?: string;
  title: string;
  video_url: string;
  display_order: number;
}

const emptyForm = { module_id: "", title: "", description: "", video_url: "", pdf_url: "", practice_text: "", display_order: 0 };

type VideoInfo = { provider: "youtube"; id: string; embedUrl: string; openUrl: string };

function parseVideo(url: string): VideoInfo | null {
  if (!url) return null;
  const trimmed = url.trim();
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) {
    return {
      provider: "youtube",
      id: yt[1],
      embedUrl: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&controls=1&disablekb=1`,
      openUrl: `https://youtu.be/${yt[1]}`,
    };
  }
  if (/^[\w-]{11}$/.test(trimmed)) {
    return {
      provider: "youtube",
      id: trimmed,
      embedUrl: `https://www.youtube.com/embed/${trimmed}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&controls=1&disablekb=1`,
      openUrl: `https://youtu.be/${trimmed}`,
    };
  }
  return null;
}

const VIDEO_SLOTS = 10;

function buildSlots(existing: LessonVideo[]): LessonVideo[] {
  const slots: LessonVideo[] = [];
  for (let i = 0; i < VIDEO_SLOTS; i++) {
    const found = existing.find((v) => v.display_order === i);
    slots.push(found ?? { title: `Videoaula ${i + 1}`, video_url: "", display_order: i });
  }
  return slots;
}

export default function LessonsManager() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [contentFilter, setContentFilter] = useState<"all" | "has_video" | "has_pdf">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);

  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [videos, setVideos] = useState<LessonVideo[]>([]);
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});
  const [isFetchingTitle, setIsFetchingTitle] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    const [{ data: lsn }, { data: mods }, { data: vids }] = await Promise.all([
      supabase.from("lessons").select("*, modules(title, display_order, courses(id, title, level))").order("display_order"),
      supabase.from("modules").select("id, title, display_order, course_id, courses(title, level)").order("display_order"),
      supabase.from("lesson_videos").select("lesson_id"),
    ]);
    if (lsn) setLessons(lsn as any);
    if (mods) setModules(mods.map((m: any) => ({
      id: m.id,
      title: m.title,
      display_order: m.display_order ?? 0,
      course_id: m.course_id ?? null,
      course_title: m.courses?.title ?? "",
      course_level: m.courses?.level ?? "",
    })));
    if (vids) {
      const counts: Record<string, number> = {};
      vids.forEach((v: any) => { counts[v.lesson_id] = (counts[v.lesson_id] ?? 0) + 1; });
      setVideoCounts(counts);
    }
  };

  useEffect(() => { load(); }, []);

  /** Cursos derivados dos módulos, na ordem canônica (Adultos → Teens → Kids). */
  const courseOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; level: string }>();
    modules.forEach((m) => {
      if (m.course_id && !map.has(m.course_id)) {
        map.set(m.course_id, { id: m.course_id, title: m.course_title, level: m.course_level });
      }
    });
    return sortCourses([...map.values()]);
  }, [modules]);

  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => {
      const c = compareCourses(
        { id: a.course_id ?? "", title: a.course_title, level: a.course_level },
        { id: b.course_id ?? "", title: b.course_title, level: b.course_level }
      );
      if (c !== 0) return c;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.title.localeCompare(b.title, "pt-BR", { numeric: true });
    });
  }, [modules]);

  const moduleOptions: SearchableOption[] = useMemo(
    () =>
      sortedModules
        .filter((m) => filterCourse === "all" || m.course_id === filterCourse)
        .map((m) => {
          const course = { id: m.course_id ?? "", title: m.course_title, level: m.course_level };
          return {
            value: m.id,
            label: `${courseLabel(course)} › ${m.title}`,
            group: segmentGroupOf(course),
            keywords: `${m.course_title} ${m.course_level} ${m.title}`,
          };
        }),
    [sortedModules, filterCourse]
  );

  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return lessons
      .filter((l) => {
        const mod = moduleById.get(l.module_id);
        const matchesSearch =
          l.title.toLowerCase().includes(q) ||
          (mod?.title ?? "").toLowerCase().includes(q) ||
          (mod?.course_title ?? "").toLowerCase().includes(q);
        const matchesCourse = filterCourse === "all" || mod?.course_id === filterCourse;
        const matchesModule = filterModule === "all" || l.module_id === filterModule;
        const matchesContent = contentFilter === "all" ? true :
                               contentFilter === "has_video" ? (videoCounts[l.id] ?? (l.video_url ? 1 : 0)) > 0 :
                               contentFilter === "has_pdf" ? !!l.pdf_url : true;
        return matchesSearch && matchesCourse && matchesModule && matchesContent;
      })
      .sort((a, b) => {
        const ma = moduleById.get(a.module_id);
        const mb = moduleById.get(b.module_id);
        const c = compareCourses(
          { id: ma?.course_id ?? "", title: ma?.course_title ?? "", level: ma?.course_level },
          { id: mb?.course_id ?? "", title: mb?.course_title ?? "", level: mb?.course_level }
        );
        if (c !== 0) return c;
        const mo = (ma?.display_order ?? 0) - (mb?.display_order ?? 0);
        if (mo !== 0) return mo;
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.title.localeCompare(b.title, "pt-BR", { numeric: true });
      });
  }, [lessons, searchQuery, filterCourse, filterModule, contentFilter, videoCounts, moduleById]);


  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, module_id: filterModule !== "all" ? filterModule : modules[0]?.id ?? "" });
    setVideos(buildSlots([]));
    setOpen(true);
  };

  const openEdit = async (l: Lesson) => {
    setEditing(l);
    setForm({ module_id: l.module_id, title: l.title, description: l.description ?? "", video_url: l.video_url ?? "", pdf_url: l.pdf_url ?? "", practice_text: l.practice_text ?? "", display_order: l.display_order });
    const { data } = await supabase
      .from("lesson_videos")
      .select("id, title, video_url, display_order")
      .eq("lesson_id", l.id)
      .order("display_order");
    setVideos(buildSlots((data ?? []) as LessonVideo[]));
    setOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "pdf") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    const folder = "pdfs";
    const path = `${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("lesson-files").upload(path, file);
    if (error) { toast.error("Erro no upload: " + error.message); setUploadingPdf(false); return; }
    const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
    setForm((prev) => ({ ...prev, pdf_url: data.publicUrl }));
    setUploadingPdf(false);
    toast.success("PDF enviado!");
  };

  const fetchYoutubeTitle = async (url: string, index: number) => {
    const info = parseVideo(url);
    if (!info) return;
    setIsFetchingTitle(index);
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${info.id}&format=json`);
      if (response.ok) {
        const data = await response.json();
        if (data.title) {
          setVideos(prev => prev.map((v, i) => i === index ? { ...v, title: data.title } : v));
          toast.success("Título recuperado!");
        }
      }
    } catch (e) {
      console.error("Error fetching YT title", e);
    } finally {
      setIsFetchingTitle(null);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.module_id) { toast.error("Preencha título e módulo"); return; }
    setLoading(true);
    const primaryVideo = videos[0]?.video_url?.trim() || form.video_url.trim() || null;
    const payload = { module_id: form.module_id, title: form.title.trim(), description: form.description.trim() || null, video_url: primaryVideo, pdf_url: form.pdf_url.trim() || null, practice_text: form.practice_text.trim() || null, display_order: form.display_order };

    let lessonId: string | null = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase.from("lessons").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else {
      const { data: inserted, error } = await supabase.from("lessons").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      lessonId = inserted!.id;
    }

    if (lessonId) {
      const keepIds = videos.filter((v) => v.id).map((v) => v.id!) as string[];
      let delQuery = supabase.from("lesson_videos").delete().eq("lesson_id", lessonId);
      if (keepIds.length > 0) delQuery = delQuery.not("id", "in", `(${keepIds.join(",")})`);
      await delQuery;

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const url = v.video_url.trim();
        if (!url) {
          if (v.id) await supabase.from("lesson_videos").delete().eq("id", v.id);
          continue;
        }
        const row = { lesson_id: lessonId, title: v.title.trim() || `Videoaula ${i + 1}`, video_url: url, display_order: i };
        if (v.id) await supabase.from("lesson_videos").update(row).eq("id", v.id);
        else await supabase.from("lesson_videos").insert(row);
      }
    }

    toast.success(editing ? "Lição atualizada!" : "Lição criada!");
    setOpen(false); setLoading(false); load();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLessons((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        const updates = newItems
          .filter(l => l.module_id === items[oldIndex].module_id)
          .map((item, idx) => ({ id: item.id, display_order: idx }));
        
        Promise.all(updates.map(u => supabase.from("lessons").update({ display_order: u.display_order }).eq("id", u.id)))
          .then(() => toast.success("Ordem atualizada"));
          
        return newItems;
      });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lição excluída"); load(); }
  };

  const bulkDelete = async () => {
    const { error } = await supabase.from("lessons").delete().in("id", selectedIds);
    if (error) toast.error(error.message);
    else { toast.success("Lições excluídas"); setSelectedIds([]); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold">Lições</h2>
          <p className="text-sm text-muted-foreground">Gerencie o conteúdo das aulas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Lição</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-lg border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por título..." 
            className="pl-9 h-9" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-[220px]">
          <SearchableSelect
            className="h-9"
            value={filterCourse}
            onChange={(v) => { setFilterCourse(v); setFilterModule("all"); }}
            groupOrder={SEGMENT_GROUP_ORDER}
            searchPlaceholder="Buscar curso..."
            options={[
              { value: "all", label: "Todos os cursos" },
              ...courseOptions.map((c) => ({ value: c.id, label: courseLabel(c), group: segmentGroupOf(c), keywords: `${c.title} ${c.level}` })),
            ]}
          />
        </div>
        <div className="w-[240px]">
          <SearchableSelect
            className="h-9"
            value={filterModule}
            onChange={setFilterModule}
            groupOrder={SEGMENT_GROUP_ORDER}
            searchPlaceholder="Buscar módulo..."
            options={[{ value: "all", label: "Todos os módulos" }, ...moduleOptions]}
          />
        </div>
        <Select value={contentFilter} onValueChange={(v: any) => setContentFilter(v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Conteúdo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="has_video">Com vídeo</SelectItem>
            <SelectItem value="has_pdf">Com PDF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds(filtered.map(c => c.id));
                      else setSelectedIds([]);
                    }}
                  />
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Mídia</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhuma lição encontrada.</TableCell></TableRow>
              )}
              <SortableContext items={filtered.map(l => l.id)} strategy={verticalListSortingStrategy}>
                {filtered.map((l) => (
                  <SortableRow key={l.id} id={l.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(l.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds([...selectedIds, l.id]);
                          else setSelectedIds(selectedIds.filter(id => id !== l.id));
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <p>{l.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Order: {l.display_order}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{(l.modules as any)?.title ?? "—"}</TableCell>
                    <TableCell className="flex gap-2 items-center">
                      {(videoCounts[l.id] ?? (l.video_url ? 1 : 0)) > 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Video className="h-3 w-3" /> {videoCounts[l.id] ?? 1}
                        </Badge>
                      )}
                      {l.pdf_url && <Badge variant="secondary"><FileText className="h-3 w-3" /></Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewLesson(l)} title="Ver como aluno"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir lição?</AlertDialogTitle><AlertDialogDescription>Lição será excluída permanentemente.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(l.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </SortableRow>
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <BulkActions selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} onDelete={bulkDelete} label="lições" />
      
      {previewLesson && <LessonPreview lesson={previewLesson} open={!!previewLesson} onOpenChange={(o) => !o && setPreviewLesson(null)} />}
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Lição" : "Nova Lição"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Módulo</Label>
              <SearchableSelect
                value={form.module_id}
                onChange={(v) => setForm({ ...form, module_id: v })}
                placeholder="Selecione o curso › módulo"
                searchPlaceholder="Buscar por curso ou módulo..."
                groupOrder={SEGMENT_GROUP_ORDER}
                options={sortedModules.map((m) => {
                  const course = { id: m.course_id ?? "", title: m.course_title, level: m.course_level };
                  return { value: m.id, label: `${courseLabel(course)} › ${m.title}`, group: segmentGroupOf(course), keywords: `${m.course_title} ${m.course_level} ${m.title}` };
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Videoaulas (10 slots)</Label>
              {videos.map((v, idx) => {
                const info = parseVideo(v.video_url);
                return (
                  <div key={v.id ?? `local-${idx}`} className="rounded-md border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                      <Input
                        value={v.title}
                        onChange={(e) => setVideos(prev => prev.map((it, i) => i === idx ? { ...it, title: e.target.value } : it))}
                        placeholder={`Título ${idx + 1}`}
                        className="h-8 text-sm"
                      />
                      {v.video_url && info && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={isFetchingTitle === idx}
                          onClick={() => fetchYoutubeTitle(v.video_url, idx)}
                          title="Recuperar título do YouTube"
                        >
                          <RefreshCw className={`h-3 w-3 ${isFetchingTitle === idx ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                      {v.video_url && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setVideos(prev => prev.map((it, i) => i === idx ? { ...it, video_url: "" } : it))}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Input
                      value={v.video_url}
                      onChange={(e) => setVideos(prev => prev.map((it, i) => i === idx ? { ...it, video_url: e.target.value } : it))}
                      placeholder="Link do YouTube"
                      onBlur={(e) => {
                        if (e.target.value && !v.title.includes("Videoaula")) {
                           // Option to auto-fetch on blur if empty
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>PDF da Aula</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="application/pdf" onChange={(e) => handleFileUpload(e, "pdf")} disabled={uploadingPdf} />
                {form.pdf_url && <Badge variant="outline">PDF ok</Badge>}
                {form.pdf_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Remover PDF"
                    onClick={() => { setForm((prev) => ({ ...prev, pdf_url: "" })); toast.success("PDF removido — salve para confirmar"); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Texto para Prática de Voz</Label>
              <Textarea value={form.practice_text} onChange={(e) => setForm({ ...form, practice_text: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
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
