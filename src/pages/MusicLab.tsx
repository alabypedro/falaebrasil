import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Search, ArrowLeft, CheckCircle2, XCircle, Sparkles, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import { LEVELS } from "@/lib/levels";
import { awardAiXp } from "@/lib/aiXp";
import { detectMedia, spotifyEmbed, youtubeEmbed, youtubeThumb, type MediaType } from "@/lib/musicMedia";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PartyPopper } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string;
  level: string;
  youtube_url: string | null;
  spotify_url: string | null;
  cover_url: string | null;
  description: string | null;
  media_type: string | null;
  media_id: string | null;
}

interface Blank {
  id: string;
  line_index: number;
  text_before: string;
  answer: string;
  text_after: string;
  hint: string | null;
}

interface Vocab {
  id: string;
  term: string;
  kind: string;
  explanation: string;
  example: string | null;
  display_order: number;
}

export const VOCAB_KINDS: { value: string; label: string }[] = [
  { value: "slang", label: "Gíria" },
  { value: "phrasal_verb", label: "Phrasal verb" },
  { value: "phonetics", label: "Fonética" },
  { value: "expression", label: "Expressão" },
];

const kindLabel = (k: string) => VOCAB_KINDS.find((v) => v.value === k)?.label ?? k;

const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/[.,!?;:"'’]/g, "").replace(/\s+/g, " ");

export default function MusicLab() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Song | null>(null);

  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mediaTab, setMediaTab] = useState<MediaType>("youtube");
  const [congrats, setCongrats] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: access }, { data }] = await Promise.all([
        supabase.rpc("has_music_lab_access", {
          _user_id: (await supabase.auth.getUser()).data.user?.id as string,
        }),
        supabase
          .from("music_lab_songs")
          .select("id,title,artist,level,youtube_url,spotify_url,cover_url,description,media_type,media_id")
          .eq("active", true),
      ]);
      setHasAccess(access !== false);
      setSongs(
        ((data as Song[]) ?? []).sort(
          (a, b) =>
            a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" }) ||
            a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
        ),
      );
      setLoading(false);
    })();
  }, []);

  const openSong = async (song: Song) => {
    setSelected(song);
    setMediaTab(
      (song.media_type as MediaType) === "spotify" && detectMedia(song.spotify_url ?? "")
        ? "spotify"
        : detectMedia(song.youtube_url ?? "")
          ? "youtube"
          : "spotify",
    );
    setCongrats(false);
    setAnswers({});
    setChecked(false);
    setDetailLoading(true);
    const [{ data: b }, { data: v }] = await Promise.all([
      supabase.from("music_lab_blanks").select("*").eq("song_id", song.id).order("line_index"),
      supabase.from("music_lab_vocabulary").select("*").eq("song_id", song.id).order("display_order"),
    ]);
    setBlanks((b as Blank[]) ?? []);
    setVocab((v as Vocab[]) ?? []);
    setDetailLoading(false);
  };

  const levelsAvailable = useMemo(() => {
    const set = new Set(songs.map((s) => s.level));
    return LEVELS.filter((l) => set.has(l));
  }, [songs]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return songs.filter((s) => {
      const okLevel = levelFilter === "all" || s.level === levelFilter;
      const okQuery =
        !q ||
        normalize(s.title).includes(q) ||
        normalize(s.artist).includes(q) ||
        normalize(s.level).includes(q);
      return okLevel && okQuery;
    });
  }, [songs, search, levelFilter]);

  const correctCount = blanks.filter((b) => normalize(answers[b.id] ?? "") === normalize(b.answer)).length;

  const handleCheck = async () => {
    if (blanks.length === 0) return;
    setChecked(true);
    if (correctCount === blanks.length) setCongrats(true);
    const points = correctCount * 5;
    if (points > 0 && selected) {
      const res = await awardAiXp("musiclab", points, `musiclab:${selected.id}:${correctCount}`);
      if (res?.awarded) toast.success(`+${res.points} XP no Music Lab!`);
      else toast.success(`${correctCount} de ${blanks.length} corretas!`);
    } else {
      toast.info("Nenhuma lacuna correta ainda — tente de novo!");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-xl space-y-4 page-transition">
        <BackToDashboardButton />
        <Card className="border-border/60">
          <CardContent className="p-8 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">Music Lab bloqueado</p>
            <p className="text-sm text-muted-foreground">
              Fale com a equipe Falaê Brasil para liberar o Music Lab no seu plano.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selected) {
    const ytId =
      detectMedia(selected.youtube_url ?? "")?.media_type === "youtube"
        ? detectMedia(selected.youtube_url ?? "")!.media_id
        : selected.media_type === "youtube"
          ? selected.media_id
          : null;
    const spId =
      detectMedia(selected.spotify_url ?? "")?.media_type === "spotify"
        ? detectMedia(selected.spotify_url ?? "")!.media_id
        : selected.media_type === "spotify"
          ? selected.media_id
          : null;
    const cover = selected.cover_url ?? (ytId ? youtubeThumb(ytId) : null);
    const activeMedia: MediaType = mediaTab === "spotify" && spId ? "spotify" : ytId ? "youtube" : "spotify";

    return (
      <div className="max-w-4xl space-y-6 page-transition">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Todas as músicas
        </Button>

        <header className="flex flex-wrap items-start gap-4">
          {cover && (
            <img
              src={cover}
              alt={`Capa de ${selected.title} — ${selected.artist}`}
              className="h-24 w-24 rounded-xl object-cover border border-border/60"
              loading="lazy"
            />
          )}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <Badge className="bg-primary/15 text-primary border border-primary/30 font-semibold">
                CEFR {selected.level}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground">
              {selected.title}
            </h1>
            <p className="text-sm text-muted-foreground">{selected.artist}</p>
            {selected.description && (
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            )}
          </div>
        </header>

        {detailLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div
            className={`space-y-6 ${
              (ytId || spId) ? "lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0" : ""
            }`}
          >
            {(ytId || spId) && (
              <div className="space-y-3 lg:sticky lg:top-4">
                {ytId && spId && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={activeMedia === "youtube" ? "default" : "outline"}
                      onClick={() => setMediaTab("youtube")}
                    >
                      Vídeo (YouTube)
                    </Button>
                    <Button
                      size="sm"
                      variant={activeMedia === "spotify" ? "default" : "outline"}
                      onClick={() => setMediaTab("spotify")}
                    >
                      Áudio (Spotify)
                    </Button>
                  </div>
                )}
                <Card className="overflow-hidden border-border/60">
                  <CardContent className="p-0">
                    {activeMedia === "youtube" && ytId ? (
                      <div className="aspect-video w-full">
                        <iframe
                          className="h-full w-full"
                          src={youtubeEmbed(ytId)}
                          title={selected.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    ) : spId ? (
                      <iframe
                        className="w-full rounded-md"
                        height={352}
                        src={spotifyEmbed(spId)}
                        title={selected.title}
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            )}

            <Tabs defaultValue="activity">
              <TabsList>
                <TabsTrigger value="activity">Preencher as lacunas</TabsTrigger>
                <TabsTrigger value="vocab">Vocabulário &amp; Expressões</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-4">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Fill in the Blanks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {blanks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Esta música ainda não tem lacunas cadastradas.
                      </p>
                    ) : (
                      <>
                        {blanks.map((b, i) => {
                          const value = answers[b.id] ?? "";
                          const ok = normalize(value) === normalize(b.answer);
                          return (
                            <div key={b.id} className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm leading-relaxed">
                                <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                                <span className="text-foreground">{b.text_before}</span>
                                <Input
                                  value={value}
                                  onChange={(e) => setAnswers((a) => ({ ...a, [b.id]: e.target.value }))}
                                  placeholder="..."
                                  className={`h-9 w-40 ${
                                    checked
                                      ? ok
                                        ? "border-success text-success"
                                        : "border-destructive text-destructive"
                                      : ""
                                  }`}
                                />
                                <span className="text-foreground">{b.text_after}</span>
                                {checked &&
                                  (ok ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  ))}
                              </div>
                              {checked && !ok && (
                                <p className="text-xs text-muted-foreground pl-6">
                                  Resposta correta: <span className="font-semibold">{b.answer}</span>
                                </p>
                              )}
                              {!checked && b.hint && (
                                <p className="text-xs text-muted-foreground pl-6">Dica: {b.hint}</p>
                              )}
                            </div>
                          );
                        })}

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <Button onClick={handleCheck}>Verificar Respostas</Button>
                          {checked && (
                            <>
                              <span className="text-sm text-muted-foreground tabular-nums">
                                {correctCount} / {blanks.length} corretas
                              </span>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setAnswers({});
                                  setChecked(false);
                                }}
                              >
                                Tentar de novo
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vocab" className="mt-4">
                <Card className="border-border/60">
                  <CardContent className="p-5 space-y-3">
                    {vocab.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum vocabulário cadastrado para esta música.
                      </p>
                    ) : (
                      <Accordion type="multiple" className="w-full">
                        {vocab.map((v) => (
                          <AccordionItem key={v.id} value={v.id}>
                            <AccordionTrigger className="text-sm">
                              <span className="flex items-center gap-2 text-left">
                                <span className="font-semibold text-foreground">{v.term}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {kindLabel(v.kind)}
                                </Badge>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-1">
                              <p className="text-sm text-muted-foreground">{v.explanation}</p>
                              {v.example && (
                                <p className="text-xs italic text-muted-foreground">“{v.example}”</p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <Dialog open={congrats} onOpenChange={setCongrats}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <PartyPopper className="h-5 w-5 text-primary" /> Parabéns!
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Você acertou 100% das lacunas de “{selected.title}” e ganhou XP no Music Lab.
            </p>
            <Button onClick={() => setCongrats(false)}>Continuar</Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 page-transition">
      <BackToDashboardButton />

      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground flex items-center gap-2">
          <Music className="h-6 w-6 text-primary" /> Music Lab
        </h1>
        <p className="text-sm text-muted-foreground">
          Aprenda inglês com música: ouça, complete a letra e explore gírias e expressões.
        </p>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por música, banda/artista ou nível (ex: B1)"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={levelFilter === "all" ? "default" : "outline"}
            onClick={() => setLevelFilter("all")}
          >
            Todos
          </Button>
          {levelsAvailable.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={levelFilter === l ? "default" : "outline"}
              onClick={() => setLevelFilter(l)}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma música encontrada.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => openSong(s)}
              className="text-left rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary hover:bg-primary/5 transition"
            >
              {(() => {
                const ytc = detectMedia(s.youtube_url ?? "");
                const cover =
                  s.cover_url ?? (ytc?.media_type === "youtube" ? youtubeThumb(ytc.media_id) : null);
                return cover ? (
                  <img src={cover} alt={`Capa de ${s.title}`} className="h-32 w-full object-cover" loading="lazy" />
                ) : null;
              })()}
              <div className="p-4 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground truncate">
                    {s.artist}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {s.level}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight">{s.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
