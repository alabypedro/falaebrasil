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
import { Brain, Plus, Pencil, Trash2, ArrowLeft, Loader2, Upload, Music, Image as ImageIcon, X, Video, RotateCcw, Sparkles, Link as LinkIcon } from "lucide-react";

interface Course { id: string; title: string; }
interface Deck {
  id: string;
  course_id: string | null;
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
}

const TOPICS = [
  { value: "vocabulario_infinito", label: "Vocabulário Infinito" },
  { value: "agilidade_mental", label: "Agilidade Mental" },
  { value: "foco_dificil", label: "Foco no que é Difícil" },
  { value: "geral", label: "Geral" },
];

export default function MemorizaeManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);

  // Deck dialog
  const [deckDialog, setDeckDialog] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckForm, setDeckForm] = useState<{ title: string; description: string; target_topic: string; course_id: string; display_order: number; }>({
    title: "", description: "", target_topic: "geral", course_id: "none", display_order: 0,
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
  const [translatingFront, setTranslatingFront] = useState(false);

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

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: ds }, { data: cd }] = await Promise.all([
      supabase.from("courses").select("id,title").order("display_order"),
      supabase.from("memorize_decks").select("*").order("display_order"),
      supabase.from("memorize_cards").select("*").order("display_order"),
    ]);
    setCourses((cs as Course[]) || []);
    setDecks((ds as Deck[]) || []);
    setCards((cd as CardRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deckCards = useMemo(() => cards.filter((c) => c.deck_id === activeDeck?.id), [cards, activeDeck]);

  // ---------- Deck actions ----------
  const openNewDeck = () => {
    setEditingDeck(null);
    setDeckForm({ title: "", description: "", target_topic: "geral", course_id: "none", display_order: decks.length });
    setDeckDialog(true);
  };
  const openEditDeck = (d: Deck) => {
    setEditingDeck(d);
    setDeckForm({
      title: d.title, description: d.description ?? "", target_topic: d.target_topic,
      course_id: d.course_id ?? "none", display_order: d.display_order,
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
      display_order: editingCard?.display_order ?? deckCards.length,
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
    const rows = lines.map((line, i) => {
      const [front, back, example] = line.split("|").map((s) => s?.trim() ?? "");
      return {
        deck_id: activeDeck.id,
        front_text: front,
        back_text: back,
        example_sentence: example || null,
        display_order: deckCards.length + i,
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
                  <TableHead className="w-24 text-right">Ações</TableHead>
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
              <div>
                <Label>Frente (inglês)</Label>
                <Textarea rows={2} value={cardForm.front} onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })} />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label>Verso (tradução / explicação)</Label>
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
                    Traduzir da frente
                  </Button>
                </div>
                <Textarea rows={2} value={cardForm.back} onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })} />
              </div>
              <div>
                <Label>Exemplo (opcional)</Label>
                <Textarea rows={2} value={cardForm.example} onChange={(e) => setCardForm({ ...cardForm, example: e.target.value })} />
              </div>
              <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                🔊 O áudio é gerado automaticamente a partir dos textos da carta (frente, verso e exemplo) — não é preciso enviar arquivo.
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label>Imagem (png, jpg, webp…)</Label>
                  {cardForm.image ? (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <img src={imagePreview} alt="preview" className="h-10 w-10 rounded object-cover shrink-0" />
                      <span className="text-xs text-muted-foreground truncate flex-1">Imagem carregada</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCardForm({ ...cardForm, image: "" }); setImagePreview(""); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
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
          <p className="text-[11px] text-muted-foreground">
            Escolha o tópico-alvo do deck (Vocabulário Infinito, Agilidade Mental, Foco no que é Difícil ou Geral)
            para orientar o aluno sobre o objetivo do treino.
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
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deck</TableHead>
                <TableHead>Tópico</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Cartas</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decks.map((d) => {
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
                    <TableCell><Badge variant="outline" className="text-[10px]">{TOPICS.find((t) => t.value === d.target_topic)?.label ?? d.target_topic}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{course?.title ?? "—"}</TableCell>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tópico-alvo</Label>
                <Select value={deckForm.target_topic} onValueChange={(v) => setDeckForm({ ...deckForm, target_topic: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TOPICS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Curso vinculado (opcional)</Label>
                <Select value={deckForm.course_id} onValueChange={(v) => setDeckForm({ ...deckForm, course_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (global)</SelectItem>
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={deckForm.display_order} onChange={(e) => setDeckForm({ ...deckForm, display_order: parseInt(e.target.value || "0", 10) })} />
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