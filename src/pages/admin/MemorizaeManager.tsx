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
import { Brain, Plus, Pencil, Trash2, ArrowLeft, Loader2, Upload, Music, Image as ImageIcon, X } from "lucide-react";

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

  // Bulk import
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkText, setBulkText] = useState("");

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
    setCardDialog(true);
  };
  const openEditCard = (c: CardRow) => {
    setEditingCard(c);
    setCardForm({
      front: c.front_text, back: c.back_text, example: c.example_sentence ?? "",
      audio: c.audio_url ?? "", image: c.image_url ?? "",
    });
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

  // ---------- UI ----------
  if (activeDeck) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveDeck(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos decks
          </Button>
          <div className="ml-auto flex gap-2">
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
                <Label>Verso (tradução / explicação)</Label>
                <Textarea rows={2} value={cardForm.back} onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })} />
              </div>
              <div>
                <Label>Exemplo (opcional)</Label>
                <Textarea rows={2} value={cardForm.example} onChange={(e) => setCardForm({ ...cardForm, example: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Áudio (mp3, wav, m4a…)</Label>
                  {cardForm.audio ? (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <Music className="h-4 w-4 text-primary shrink-0" />
                      <audio src={cardForm.audio} controls className="h-8 flex-1 min-w-0" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCardForm({ ...cardForm, audio: "" })}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition">
                      {uploadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span>{uploadingAudio ? "Enviando…" : "Selecionar áudio"}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        disabled={uploadingAudio}
                        onChange={(e) => handleAudioFile(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Imagem (png, jpg, webp…)</Label>
                  {cardForm.image ? (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <img src={cardForm.image} alt="preview" className="h-10 w-10 rounded object-cover shrink-0" />
                      <span className="text-xs text-muted-foreground truncate flex-1">Imagem carregada</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCardForm({ ...cardForm, image: "" })}>
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