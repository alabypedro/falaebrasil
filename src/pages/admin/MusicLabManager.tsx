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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Music, Search, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { LEVELS } from "@/lib/levels";
import { VOCAB_KINDS } from "@/pages/MusicLab";

interface Song {
  id: string;
  title: string;
  artist: string;
  level: string;
  youtube_url: string | null;
  spotify_url: string | null;
  cover_url: string | null;
  description: string | null;
  active: boolean;
  display_order: number;
}

interface Blank {
  id?: string;
  line_index: number;
  text_before: string;
  answer: string;
  text_after: string;
  hint: string | null;
}

interface Vocab {
  id?: string;
  term: string;
  kind: string;
  explanation: string;
  example: string | null;
  display_order: number;
}

const emptySong = {
  title: "",
  artist: "",
  level: "A1",
  youtube_url: "",
  spotify_url: "",
  cover_url: "",
  description: "",
  active: true,
  display_order: 0,
};

export default function MusicLabManager() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [form, setForm] = useState({ ...emptySong });
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("music_lab_songs").select("*");
    setSongs(
      ((data as Song[]) ?? []).sort(
        (a, b) =>
          a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" }) ||
          a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return songs.filter((s) => {
      const okLevel = levelFilter === "all" || s.level === levelFilter;
      const okQ =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.level.toLowerCase().includes(q);
      return okLevel && okQ;
    });
  }, [songs, search, levelFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptySong });
    setBlanks([]);
    setVocab([]);
    setOpen(true);
  };

  const openEdit = async (song: Song) => {
    setEditing(song);
    setForm({
      title: song.title,
      artist: song.artist,
      level: song.level,
      youtube_url: song.youtube_url ?? "",
      spotify_url: song.spotify_url ?? "",
      cover_url: song.cover_url ?? "",
      description: song.description ?? "",
      active: song.active,
      display_order: song.display_order,
    });
    const [{ data: b }, { data: v }] = await Promise.all([
      supabase.from("music_lab_blanks").select("*").eq("song_id", song.id).order("line_index"),
      supabase
        .from("music_lab_vocabulary")
        .select("*")
        .eq("song_id", song.id)
        .order("display_order"),
    ]);
    setBlanks((b as Blank[]) ?? []);
    setVocab((v as Vocab[]) ?? []);
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.artist.trim()) {
      toast.error("Informe título e artista/banda.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        artist: form.artist.trim(),
        level: form.level,
        youtube_url: form.youtube_url.trim() || null,
        spotify_url: form.spotify_url.trim() || null,
        cover_url: form.cover_url.trim() || null,
        description: form.description.trim() || null,
        active: form.active,
        display_order: form.display_order,
      };

      let songId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("music_lab_songs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("music_lab_songs")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        songId = (data as { id: string }).id;
      }
      if (!songId) throw new Error("Falha ao salvar a música");

      await supabase.from("music_lab_blanks").delete().eq("song_id", songId);
      const validBlanks = blanks.filter((b) => b.answer.trim());
      if (validBlanks.length) {
        const { error } = await supabase.from("music_lab_blanks").insert(
          validBlanks.map((b, i) => ({
            song_id: songId,
            line_index: i,
            text_before: b.text_before ?? "",
            answer: b.answer.trim(),
            text_after: b.text_after ?? "",
            hint: b.hint?.trim() || null,
          })),
        );
        if (error) throw error;
      }

      await supabase.from("music_lab_vocabulary").delete().eq("song_id", songId);
      const validVocab = vocab.filter((v) => v.term.trim() && v.explanation.trim());
      if (validVocab.length) {
        const { error } = await supabase.from("music_lab_vocabulary").insert(
          validVocab.map((v, i) => ({
            song_id: songId,
            term: v.term.trim(),
            kind: v.kind,
            explanation: v.explanation.trim(),
            example: v.example?.trim() || null,
            display_order: i,
          })),
        );
        if (error) throw error;
      }

      toast.success(editing ? "Música atualizada" : "Música criada");
      setOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (song: Song) => {
    if (!confirm(`Excluir "${song.title}" (${song.artist})?`)) return;
    const { error } = await supabase.from("music_lab_songs").delete().eq("id", song.id);
    if (error) return toast.error(error.message);
    toast.success("Música excluída");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" /> Music Lab
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre músicas, lacunas da letra e vocabulário.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova música
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por música, banda/artista ou nível"
            className="pl-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma música cadastrada.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className="border-border/60">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{s.artist}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {s.level}
                    </Badge>
                    {!s.active && (
                      <Badge variant="outline" className="text-[10px]">
                        inativa
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{s.title}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(s)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar música" : "Nova música"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Título da música</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Artista / banda</Label>
                <Input
                  value={form.artist}
                  onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Nível CEFR</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Link do YouTube</Label>
                <Input
                  value={form.youtube_url}
                  onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="space-y-1">
                <Label>Link do Spotify</Label>
                <Input
                  value={form.spotify_url}
                  onChange={(e) => setForm((f) => ({ ...f, spotify_url: e.target.value }))}
                  placeholder="https://open.spotify.com/track/..."
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Capa (URL da imagem)</Label>
                <Input
                  value={form.cover_url}
                  onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                />
                Música ativa (visível para os alunos)
              </label>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase text-muted-foreground">
                  Lacunas da letra (Fill in the Blanks)
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBlanks((b) => [
                      ...b,
                      { line_index: b.length, text_before: "", answer: "", text_after: "", hint: "" },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Lacuna
                </Button>
              </div>
              {blanks.map((b, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Linha {i + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBlanks((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Trecho antes da lacuna"
                      value={b.text_before}
                      onChange={(e) =>
                        setBlanks((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, text_before: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Resposta (palavra da lacuna)"
                      value={b.answer}
                      onChange={(e) =>
                        setBlanks((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Trecho depois da lacuna"
                      value={b.text_after}
                      onChange={(e) =>
                        setBlanks((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, text_after: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <Input
                    placeholder="Dica (opcional)"
                    value={b.hint ?? ""}
                    onChange={(e) =>
                      setBlanks((list) =>
                        list.map((x, idx) => (idx === i ? { ...x, hint: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase text-muted-foreground">
                  Vocabulário &amp; Expressões
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setVocab((v) => [
                      ...v,
                      {
                        term: "",
                        kind: "expression",
                        explanation: "",
                        example: "",
                        display_order: v.length,
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Termo
                </Button>
              </div>
              {vocab.map((v, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Termo / expressão"
                      value={v.term}
                      onChange={(e) =>
                        setVocab((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, term: e.target.value } : x)),
                        )
                      }
                    />
                    <Select
                      value={v.kind}
                      onValueChange={(val) =>
                        setVocab((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, kind: val } : x)),
                        )
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOCAB_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVocab((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Explicação simples"
                    rows={2}
                    value={v.explanation}
                    onChange={(e) =>
                      setVocab((list) =>
                        list.map((x, idx) => (idx === i ? { ...x, explanation: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="Exemplo (opcional)"
                    value={v.example ?? ""}
                    onChange={(e) =>
                      setVocab((list) =>
                        list.map((x, idx) => (idx === i ? { ...x, example: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
