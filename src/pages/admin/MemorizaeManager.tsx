import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { compareCourses, courseLabel, segmentGroupOf, sortCourses, SEGMENT_GROUP_ORDER, SegmentGroup } from "@/lib/courseOrder";
import { Search } from "lucide-react";
import { Brain, Plus, Pencil, Trash2, ArrowLeft, Loader2, Upload, Music, Image as ImageIcon, X, Video, RotateCcw, Sparkles, Link as LinkIcon, ChevronUp, ChevronDown } from "lucide-react";

interface Course { id: string; title: string; level?: string | null }
interface BstProduct { id: string; title: string; }
interface Deck {
  id: string;
  course_id: string | null;
  bst_product_id: string | null;
  title: string;
  description: string | null;
  target_topic: string;
  display_order: number;
}
interface CardRow {
  id: string;
  deck_id: string;
  front_text: string;
  back_text: string;
  example_sentence: string | null;
  audio_url: string | null;
  image_url: string | null;
  display_order: number;
  created_at?: string | null;
}

export default function MemorizaeManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [bstProducts, setBstProducts] = useState<BstProduct[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);

  // Deck dialog
  const [deckDialog, setDeckDialog] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckForm, setDeckForm] = useState<{ title: string; description: string; target_topic: string; course_id: string; bst_product_id: string; display_order: number; }>({
    title: "", description: "", target_topic: "geral", course_id: "none", bst_product_id: "none", display_order: 0,
  });

  // Card dialog
  const [cardDialog, setCardDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CardRow | null>(null);
  const [cardForm, setCardForm] = useState<{ front: string; back: string; example: string; audio: string; image: string; }>({
    front: "", back: "", example: "", audio: "", image: "",
  });
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [audioPreview, setAudioPreview] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageZoom, setImageZoom] = useState(false);
  const [translatingFront, setTranslatingFront] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Bulk import
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Video import (AI)
  const [videoDialog, setVideoDialog] = useState(false);
  const [videoSource, setVideoSource] = useState<"file" | "url">("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMax, setVideoMax] = useState(20);
  const [videoBusy, setVideoBusy] = useState(false);

  // Reset review by email
  const [resetEmail, setResetEmail] = useState("");
  const [resetScope, setResetScope] = useState<"all" | "deck">("all");
  const [resetDeckId, setResetDeckId] = useState<string>("");
  const [resetBusy, setResetBusy] = useState(false);

  // Course filter (pill buttons on deck list)
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [deckSearch, setDeckSearch] = useState("");

  const groupedCourses = useMemo(() => {
    const order: SegmentGroup[] = SEGMENT_GROUP_ORDER;
    return order
      .map((group) => ({ group, items: courses.filter((c) => segmentGroupOf(c) === group) }))
      .filter((g) => g.items.length > 0);
  }, [courses]);

  const sortedDecks = useMemo(() => {
    const byId = new Map(courses.map((c) => [c.id, c]));
    return [...decks].sort((a, b) => {
      const ca = a.course_id ? byId.get(a.course_id) : undefined;
      const cb = b.course_id ? byId.get(b.course_id) : undefined;
      if (!ca && cb) return 1;
      if (ca && !cb) return -1;
      if (ca && cb) {
        const c = compareCourses(ca, cb);
        if (c !== 0) return c;
      }
      if ((a.display_order ?? 0) !== (b.display_order ?? 0)) return (a.display_order ?? 0) - (b.display_order ?? 0);
      return a.title.localeCompare(b.title, "pt-BR", { numeric: true });
    });
  }, [decks, courses]);

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: ds }, { data: cd }, { data: bp }] = await Promise.all([
      supabase.from("courses").select("id,title,level").order("display_order"),
      supabase.from("memorize_decks").select("*").order("display_order"),
      supabase.from("memorize_cards").select("*").order("display_order"),
      supabase.from("bst_products").select("id,title").order("display_order"),
    ]);
    setCourses(sortCourses(((cs as Course[]) || [])));
    setBstProducts((bp as BstProduct[]) || []);
    setDecks((ds as Deck[]) || []);
    setCards((cd as CardRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deckCards = useMemo(() => {
    const list = cards.filter((c) => c.deck_id === activeDeck?.id);
    return list.sort((a, b) => {
      const d = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (d !== 0) return d;
      const t = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    });
  }, [cards, activeDeck]);

  const nextCardOrder = () =>
    deckCards.length ? Math.max(...deckCards.map((c) => c.display_order ?? 0)) + 1 : 0;

  // ---------- Deck actions ----------
  const openNewDeck = () => {
    setEditingDeck(null);
    setDeckForm({ title: "", description: "", target_topic: "geral", course_id: "none", bst_product_id: "none", display_order: decks.length });
    setDeckDialog(true);
  };
  const openEditDeck = (d: Deck) => {
    setEditingDeck(d);
    setDeckForm({
      title: d.title, description: d.description ?? "", target_topic: d.target_topic,
      course_id: d.course_id ?? "none", bst_product_id: d.bst_product_id ?? "none", display_order: d.display_order,
    });
    setDeckDialog(true);
  };
  const saveDeck = async () => {
    if (!deckForm.title.trim()) { toast.error("Título é obrigatório"); return; }
    const payload = {
      title: deckForm.title.trim(),
      description: deckForm.description.trim() || null,
      target_topic: deckForm.target_topic,
      course_id: deckForm.course_id === "none" ? null : deckForm.course_id,
      bst_product_id: deckForm.bst_product_id === "none" ? null : deckForm.bst_product_id,
      display_order: deckForm.display_order,
    };
    const { error } = editingDeck
      ? await supabase.from("memorize_decks").update(payload).eq("id", editingDeck.id)
      : await supabase.from("memorize_decks").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingDeck ? "Deck atualizado" : "Deck criado");
    setDeckDialog(false);
    load();
  };
  const deleteDeck = async (id: string) => {
    const { error } = await supabase.from("memorize_decks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deck removido");
    if (activeDeck?.id === id) setActiveDeck(null);
    load();
  };

  // ---------- Card actions ----------
  const openNewCard = () => {
    setEditingCard(null);
    setCardForm({ front: "", back: "", example: "", audio: "", image: "" });
    setAudioPreview("");
    setImagePreview("");
    setCardDialog(true);
  };
  const openEditCard = async (c: CardRow) => {
    setEditingCard(c);
    setCardForm({
      front: c.front_text, back: c.back_text, example: c.example_sentence ?? "",
      audio: c.audio_url ?? "", image: c.image_url ?? "",
    });
    setAudioPreview(c.audio_url ? await signMemorizaeUrl(c.audio_url) : "");
    setImagePreview(c.image_url ? await signMemorizaeUrl(c.image_url) : "");
    setCardDialog(true);
  };
  const saveCard = async () => {
    if (!activeDeck) return;
    if (!cardForm.front.trim() || !cardForm.back.trim()) { toast.error("Frente e verso são obrigatórios"); return; }
    const payload = {
      deck_id: activeDeck.id,
      front_text: cardForm.front.trim(),
      back_text: cardForm.back.trim(),
      example_sentence: cardForm.example.trim() || null,
      audio_url: cardForm.audio.trim() || null,
      image_url: cardForm.image.trim() || null,
      display_order: editingCard?.display_order ?? nextCardOrder(),
    };
    const { error } = editingCard
      ? await supabase.from("memorize_cards").update(payload).eq("id", editingCard.id)
      : await supabase.from("memorize_cards").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingCard ? "Carta atualizada" : "Carta adicionada");
    setCardDialog(false);
    load();
  };
  const deleteCard = async (id: string) => {
    const { error } = await supabase.from("memorize_cards").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Carta removida");
    load();
  };

  // Move uma carta uma posição para cima (-1) ou para baixo (+1).
  // A numeração é reescrita em sequência (0..n-1) para o deck inteiro,
  // o que também conserta cartas que ficaram com a mesma ordem.
  const moveCard = async (cardId: string, dir: -1 | 1) => {
    if (!activeDeck || movingId) return;
    const ordered = [...deckCards];
    const from = ordered.findIndex((c) => c.id === cardId);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const changes = ordered
      .map((c, i) => ({ id: c.id, display_order: i, previous: c.display_order ?? 0 }))
      .filter((row, i) => row.display_order !== (ordered[i].display_order ?? 0));
    if (changes.length === 0) return;
    setMovingId(cardId);
    for (const row of changes) {
      const { error } = await supabase
        .from("memorize_cards")
        .update({ display_order: row.display_order })
        .eq("id", row.id);
      if (error) {
        setMovingId(null);
        toast.error(error.message);
        load();
        return;
      }
    }
    setMovingId(null);
    setCards((prev) =>
      prev.map((c) => {
        const hit = changes.find((r) => r.id === c.id);
        return hit ? { ...c, display_order: hit.display_order } : c;
      })
    );
  };

  // ---------- File uploads ----------
  const uploadAsset = async (file: File, kind: "audio" | "image"): Promise<string | null> => {
    const maxMb = kind === "audio" ? 15 : 8;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx ${maxMb}MB)`);
      return null;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "audio" ? "mp3" : "png");
    const path = `${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("memorizae-assets")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) { toast.error(`Falha no upload: ${error.message}`); return null; }
    // Bucket is private; store the storage path and sign on read.
    return path;
  };

  const signMemorizaeUrl = async (value: string): Promise<string> => {
    const marker = "/memorizae-assets/";
    const i = value.indexOf(marker);
    const path = i >= 0 ? value.slice(i + marker.length) : value;
    const { data } = await supabase.storage.from("memorizae-assets").createSignedUrl(path, 3600);
    return data?.signedUrl ?? "";
  };

  const handleAudioFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAudio(true);
    const path = await uploadAsset(file, "audio");
    setUploadingAudio(false);
    if (path) {
      setCardForm((f) => ({ ...f, audio: path }));
      setAudioPreview(await signMemorizaeUrl(path));
    }
  };
  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    const path = await uploadAsset(file, "image");
    setUploadingImage(false);
    if (path) {
      setCardForm((f) => ({ ...f, image: path }));
      setImagePreview(await signMemorizaeUrl(path));
    }
  };

  const bulkImport = async () => {
    if (!activeDeck) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const baseOrder = nextCardOrder();
    const rows = lines.map((line, i) => {
      const [front, back, example] = line.split("|").map((s) => s?.trim() ?? "");
      return {
        deck_id: activeDeck.id,
        front_text: front,
        back_text: back,
        example_sentence: example || null,
        display_order: baseOrder + i,
      };
    }).filter((r) => r.front_text && r.back_text);
    if (rows.length === 0) { toast.error("Nenhuma linha válida (formato: frente | verso | exemplo)"); return; }
    const { error } = await supabase.from("memorize_cards").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} cartas importadas`);
    setBulkDialog(false);
    setBulkText("");
    load();
  };

  const importVideo = async () => {
    if (!activeDeck) return;
    if (videoSource === "file" && !videoFile) { toast.error("Selecione um vídeo"); return; }
    if (videoSource === "url" && !videoUrl.trim()) { toast.error("Informe a URL do vídeo"); return; }
    setVideoBusy(true);
    try {
      const fd = new FormData();
      if (videoSource === "file" && videoFile) fd.append("file", videoFile);
      if (videoSource === "url") fd.append("url", videoUrl.trim());
      fd.append("deck_id", activeDeck.id);
      fd.append("max_cards", String(videoMax));
      const { data: sess } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("memorizae-import-video", {
        body: fd,
        headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${(data as any).inserted} cartas geradas pela IA`);
      setVideoDialog(false);
      setVideoFile(null);
      setVideoUrl("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao importar vídeo");
    } finally {
      setVideoBusy(false);
    }
  };

  const resetReview = async () => {
    const email = resetEmail.trim().toLowerCase();
    if (!email) { toast.error("Informe o email"); return; }
    if (resetScope === "deck" && !resetDeckId) { toast.error("Selecione o deck"); return; }
    setResetBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("memorizae-reset-review", {
        body: { email, scope: resetScope, deck_id: resetScope === "deck" ? resetDeckId : null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${(data as any).deleted} revisões resetadas para ${email}`);
      setResetEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao resetar");
    } finally {
      setResetBusy(false);
    }
  };

  // ---------- UI ----------
  if (activeDeck) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveDeck(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos decks
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setVideoDialog(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> Importar vídeo (IA)
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkDialog(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar em lote
            </Button>
            <Button size="sm" onClick={openNewCard}>
              <Plus className="h-4 w-4 mr-1" /> Nova carta
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> {activeDeck.title}
            </CardTitle>
            {activeDeck.description && <p className="text-xs text-muted-foreground">{activeDeck.description}</p>}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Frente</TableHead>
                  <TableHead>Verso</TableHead>
                  <TableHead>Exemplo</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deckCards.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhuma carta ainda.</TableCell></TableRow>
                ) : deckCards.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.front_text}</TableCell>
                    <TableCell className="text-primary">{c.back_text}</TableCell>
                    <TableCell className="text-xs text-muted-foreground italic">{c.example_sentence || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Mover para cima"
                          aria-label="Mover carta para cima"
                          disabled={movingId !== null || i === 0}
                          onClick={() => moveCard(c.id, -1)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Mover para baixo"
                          aria-label="Mover carta para baixo"
                          disabled={movingId !== null || i === deckCards.length - 1}
                          onClick={() => moveCard(c.id, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditCard(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover esta carta?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCard(c.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Card dialog */}
        <Dialog open={cardDialog} onOpenChange={setCardDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCard ? "Editar carta" : "Nova carta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                A frente da carta mostra apenas a imagem e o botão "Ouça e Repita". A sentença em inglês e a tradução aparecem no verso, depois que o aluno vira a carta.
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verso (aparece depois de virar)</div>
                <div>
                  <Label>Sentença em inglês (usada no áudio)</Label>
                  <Textarea rows={2} value={cardForm.front} onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label>Tradução em português</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={translatingFront || !cardForm.front.trim()}
                    onClick={async () => {
                      setTranslatingFront(true);
                      try {
                        const { data, error } = await supabase.functions.invoke("translate-en-pt", {
                          body: { text: cardForm.front.trim() },
                        });
                        if (error) throw error;
                        if ((data as any)?.error) throw new Error((data as any).error);
                        const translation = (data as any)?.translation?.trim();
                        if (translation) {
                          setCardForm((f) => ({ ...f, back: translation }));
                          toast.success("Tradução preenchida");
                        } else {
                          toast.error("Tradução vazia");
                        }
                      } catch (e: any) {
                        toast.error(e.message ?? "Falha ao traduzir");
                      } finally {
                        setTranslatingFront(false);
                      }
                    }}
                  >
                    {translatingFront ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    Traduzir do inglês
                  </Button>
                </div>
                <Textarea rows={2} value={cardForm.back} onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })} />
                <div>
                  <Label>Exemplo (opcional)</Label>
                  <Textarea rows={2} value={cardForm.example} onChange={(e) => setCardForm({ ...cardForm, example: e.target.value })} />
                </div>
              </div>
              <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                🔊 O áudio é gerado automaticamente a partir dos textos da carta (frente, verso e exemplo) — não é preciso enviar arquivo.
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label>Imagem (png, jpg, webp…)</Label>
                  {cardForm.image ? (
                    <div className="space-y-2 rounded-md border p-2">
                      <button
                        type="button"
                        onClick={() => setImageZoom(true)}
                        className="block w-full overflow-hidden rounded-md bg-muted/40"
                        title="Clique para ampliar"
                      >
                        <img
                          src={imagePreview}
                          alt={cardForm.front || "Pré-visualização da imagem da carta"}
                          className="max-h-72 w-full object-contain"
                        />
                      </button>
                      <p className="text-center text-sm font-medium">
                        {cardForm.front || <span className="text-muted-foreground">Sem sentença em inglês</span>}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Clique na imagem para ampliar</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => { setCardForm({ ...cardForm, image: "" }); setImagePreview(""); }}
                        >
                          <X className="h-3.5 w-3.5" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition">
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      <span>{uploadingImage ? "Enviando…" : "Selecionar imagem"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => handleImageFile(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCardDialog(false)}>Cancelar</Button>
              <Button onClick={saveCard}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Zoom da imagem da carta */}
        <Dialog open={imageZoom} onOpenChange={setImageZoom}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-base">{cardForm.front || "Imagem da carta"}</DialogTitle>
            </DialogHeader>
            {imagePreview && (
              <img
                src={imagePreview}
                alt={cardForm.front || "Imagem da carta em tamanho ampliado"}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk import dialog */}
        <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar cartas em lote</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Uma carta por linha, no formato: <code>frente | verso | exemplo</code></p>
              <Textarea rows={10} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Good morning | Bom dia | Good morning, how are you?" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialog(false)}>Cancelar</Button>
              <Button onClick={bulkImport}>Importar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Video → AI import dialog */}
        <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Gerar cartas a partir de vídeo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Envie um vídeo em inglês (mp4/webm/mov, até 20MB) ou cole a URL de um mp4.
                A IA vai assistir, escolher as palavras-chave mais úteis
                e criará automaticamente cartas (frente/verso/exemplo) neste deck.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={videoSource === "file" ? "default" : "outline"}
                  onClick={() => setVideoSource("file")}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" /> Arquivo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={videoSource === "url" ? "default" : "outline"}
                  onClick={() => setVideoSource("url")}
                >
                  <LinkIcon className="h-3.5 w-3.5 mr-1" /> Link
                </Button>
              </div>
              <div className="space-y-1.5">
                {videoSource === "file" ? (
                  videoFile ? (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <Video className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs truncate flex-1">{videoFile.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVideoFile(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-md border border-dashed p-4 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition">
                      <Upload className="h-4 w-4" />
                      <span>Selecionar vídeo (mp4/webm/mov)</span>
                      <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" className="hidden"
                        onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                    </label>
                  )
                ) : (
                  <Input
                    placeholder="https://exemplo.com/aula.mp4"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Máximo de cartas a gerar</Label>
                <Input type="number" min={5} max={60} value={videoMax}
                  onChange={(e) => setVideoMax(parseInt(e.target.value || "20", 10))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVideoDialog(false)} disabled={videoBusy}>Cancelar</Button>
              <Button onClick={importVideo} disabled={videoBusy || (videoSource === "file" ? !videoFile : !videoUrl.trim())}>
                {videoBusy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando…</> : "Gerar cartas"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" /> IA Memorizaê — Decks SRS
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            Cadastre decks de flashcards baseados no conteúdo dos cursos. O algoritmo SM-2 agenda automaticamente
            cada revisão para destruir a Curva do Esquecimento.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={openNewDeck}><Plus className="h-4 w-4 mr-1" /> Novo deck</Button>
      </div>

      {/* Reset review by email */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <RotateCcw className="h-4 w-4 text-primary" /> Resetar revisões de um aluno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Apaga o histórico "Errei / Bom / Fácil" do aluno para forçá-lo a revisar as cartas novamente.
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
            <Input
              placeholder="email@exemplo.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
            <Select value={resetScope} onValueChange={(v: "all" | "deck") => setResetScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os decks</SelectItem>
                <SelectItem value="deck">Um deck específico</SelectItem>
              </SelectContent>
            </Select>
            {resetScope === "deck" ? (
              <Select value={resetDeckId} onValueChange={setResetDeckId}>
                <SelectTrigger><SelectValue placeholder="Escolha o deck" /></SelectTrigger>
                <SelectContent>
                  {decks.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : <div />}
            <Button onClick={resetReview} disabled={resetBusy}>
              {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resetar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : decks.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum deck ainda. Crie o primeiro.</CardContent></Card>
      ) : (
        <>
        <div className="space-y-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar deck..." className="pl-9 h-9" value={deckSearch} onChange={(e) => setDeckSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap items-center">
            <Button size="sm" variant={courseFilter === "all" ? "default" : "outline"} onClick={() => setCourseFilter("all")}>Todos</Button>
            <Button size="sm" variant={courseFilter === "none" ? "default" : "outline"} onClick={() => setCourseFilter("none")}>Global</Button>
          </div>
          {groupedCourses.map(({ group, items }) => (
            <div key={group} className="flex gap-1 flex-wrap items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16">{group}</span>
              {items.map((c) => (
                <Button key={c.id} size="sm" variant={courseFilter === c.id ? "default" : "outline"} onClick={() => setCourseFilter(c.id)}>
                  {courseLabel(c)}
                </Button>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deck</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Cartas</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDecks
                .filter((d) =>
                  courseFilter === "all" ? true :
                  courseFilter === "none" ? d.course_id === null :
                  d.course_id === courseFilter
                )
                .filter((d) => {
                  const q = deckSearch.toLowerCase();
                  if (!q) return true;
                  const course = courses.find((c) => c.id === d.course_id);
                  return d.title.toLowerCase().includes(q) || (course?.title ?? "").toLowerCase().includes(q);
                })
                .map((d) => {
                const count = cards.filter((c) => c.deck_id === d.id).length;
                const course = courses.find((c) => c.id === d.course_id);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <button className="text-left font-medium hover:text-primary" onClick={() => setActiveDeck(d)}>
                        {d.title}
                      </button>
                      {d.description && <div className="text-[11px] text-muted-foreground">{d.description}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{course ? courseLabel(course) : "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{count}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setActiveDeck(d)}>Abrir</Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDeck(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover o deck "{d.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>Todas as cartas e o histórico dos alunos serão perdidos.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteDeck(d.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Deck dialog */}
      <Dialog open={deckDialog} onOpenChange={setDeckDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDeck ? "Editar deck" : "Novo deck"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={deckForm.title} onChange={(e) => setDeckForm({ ...deckForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={deckForm.description} onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Curso vinculado (opcional)</Label>
              <Select value={deckForm.course_id} onValueChange={(v) => setDeckForm({ ...deckForm, course_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (global)</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{courseLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={deckForm.display_order} onChange={(e) => setDeckForm({ ...deckForm, display_order: parseInt(e.target.value || "0", 10) })} />
            </div>
            <div>
              <Label>Produto BST (opcional)</Label>
              <Select value={deckForm.bst_product_id} onValueChange={(v) => setDeckForm({ ...deckForm, bst_product_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (plataforma FB)</SelectItem>
                  {bstProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Ao vincular, o baralho aparece só dentro do produto BST.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeckDialog(false)}>Cancelar</Button>
            <Button onClick={saveDeck}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}