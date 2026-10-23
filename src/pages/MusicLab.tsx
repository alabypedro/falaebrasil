import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Search, ArrowLeft, Lock, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import LyricsGame from "@/components/musiclab/LyricsGame";
import { readLyricsActivity } from "@/lib/cantaeGame";
import { useLanguage } from "@/contexts/LanguageContext";

interface Song {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  description: string | null;
  lyrics_activity?: unknown;
}

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,!?;:"'’]/g, "").replace(/\s+/g, " ");

export default function MusicLab() {
  const { language } = useLanguage();
  const en = language === "en";
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Song | null>(null);

  useEffect(() => {
    (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id as string;
      const [{ data: access }, { data }] = await Promise.all([
        supabase.rpc("has_music_lab_access", { _user_id: uid }),
        supabase.from("music_lab_songs").select("id,title,artist,cover_url,description,lyrics_activity").eq("active", true),
      ]);
      setHasAccess(access !== false);
      setSongs(
        ((data as Song[]) ?? [])
          .filter((s) => readLyricsActivity(s.lyrics_activity))
          .sort(
            (a, b) =>
              a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" }) ||
              a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
          ),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return songs.filter((s) => !q || normalize(s.title).includes(q) || normalize(s.artist).includes(q));
  }, [songs, search]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-xl space-y-4 page-transition">
        <BackToDashboardButton />
        <Card className="border-border/60">
          <CardContent className="p-8 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">{en ? "Cantaê locked" : "Cantaê bloqueado"}</p>
            <p className="text-sm text-muted-foreground">
              {en
                ? "Contact the Falaê Brasil team to unlock Cantaê in your plan."
                : "Fale com a equipe Falaê Brasil para liberar o Cantaê no seu plano."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activity = selected ? readLyricsActivity(selected.lyrics_activity) : null;
  if (selected && activity) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3 sm:space-y-6 page-transition">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {en ? "All songs" : "Todas as músicas"}
        </Button>
        <header className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-foreground">{selected.title}</h1>
          <p className="text-sm text-muted-foreground">{selected.artist}</p>
        </header>
        <LyricsGame activity={activity} title={selected.title} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-transition">
      <BackToDashboardButton />
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground flex items-center gap-2">
          <Music className="h-6 w-6 text-primary" /> Cantaê
        </h1>
        <p className="text-sm text-muted-foreground">
          {en
            ? "Learn English with music: watch the official clip, pick the missing words and read the lyrics."
            : "Aprenda inglês com música: assista ao clipe oficial, escolha as palavras que faltam e leia a letra."}
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={en ? "Search by song or artist/band" : "Buscar por música ou cantor/banda"}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{en ? "No songs found." : "Nenhuma música encontrada."}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground break-words">{s.artist}</p>
                <p className="text-sm text-muted-foreground break-words">{s.title}</p>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => setSelected(s)}
                aria-label={`${en ? "Play" : "Jogar"}: ${s.title} — ${s.artist}`}
              >
                <Play className="h-4 w-4" />
                {en ? "Play" : "Play"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const VOCAB_KINDS: { value: string; label: string }[] = [
  { value: "slang", label: "Gíria" },
  { value: "phrasal_verb", label: "Phrasal verb" },
  { value: "phonetics", label: "Fonética" },
  { value: "expression", label: "Expressão" },
];
