import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, ArrowLeft, Loader2, Volume2, Sparkles, Trophy, Timer, Target } from "lucide-react";
import { toast } from "sonner";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  target_topic: string;
  display_order: number;
  course_id: string | null;
}

interface Card {
  id: string;
  deck_id: string;
  front_text: string;
  back_text: string;
  example_sentence: string | null;
  audio_url: string | null;
  image_url: string | null;
}

interface ReviewRow {
  card_id: string;
  due_at: string;
  interval_days: number;
  repetitions: number;
  lapses: number;
  ease_factor: number;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = typeof LEVELS[number];

const NEW_PER_DAY = 20;

function formatInterval(days: number) {
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)}min`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${Math.round(days / 30)}mo`;
}

export default function Memorizae() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [courseLevelById, setCourseLevelById] = useState<Record<string, string>>({});
  const [selectedLevel, setSelectedLevel] = useState<Level>("A1");
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, Card[]>>({});
  const [reviews, setReviews] = useState<Record<string, ReviewRow>>({});
  const [loading, setLoading] = useState(true);

  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, good: 0, easy: 0, again: 0, hard: 0 });
  const [busy, setBusy] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const extractPath = (value: string) => {
    const marker = "/memorizae-assets/";
    const i = value.indexOf(marker);
    return i >= 0 ? value.slice(i + marker.length) : value;
  };

  const ensureSigned = async (raw: string | null): Promise<string | null> => {
    if (!raw) return null;
    if (signedUrls[raw]) return signedUrls[raw];
    const path = extractPath(raw);
    const { data } = await supabase.storage
      .from("memorizae-assets")
      .createSignedUrl(path, 3600);
    const url = data?.signedUrl ?? null;
    if (url) setSignedUrls((s) => ({ ...s, [raw]: url }));
    return url;
  };

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: c }, { data: r }, { data: cs }] = await Promise.all([
      supabase.from("memorize_decks").select("id,title,description,target_topic,display_order,course_id").order("display_order"),
      supabase.from("memorize_cards").select("id,deck_id,front_text,back_text,example_sentence,audio_url,image_url").order("display_order"),
      user
        ? supabase.from("user_card_reviews").select("card_id,due_at,interval_days,repetitions,lapses,ease_factor").eq("user_id", user.id)
        : Promise.resolve({ data: [] as any }),
      supabase.from("courses").select("id,level"),
    ]);
    setDecks((d as Deck[]) || []);
    const lvlMap: Record<string, string> = {};
    ((cs as { id: string; level: string }[]) || []).forEach((c) => { lvlMap[c.id] = c.level; });
    setCourseLevelById(lvlMap);
    const grouped: Record<string, Card[]> = {};
    ((c as Card[]) || []).forEach((card) => {
      (grouped[card.deck_id] ||= []).push(card);
    });
    setCardsByDeck(grouped);
    const revMap: Record<string, ReviewRow> = {};
    ((r as ReviewRow[]) || []).forEach((rv) => { revMap[rv.card_id] = rv; });
    setReviews(revMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // Pre-sign assets of the current card + next one for smooth playback
  useEffect(() => {
    if (!activeDeck) return;
    const toSign = [queue[idx], queue[idx + 1]].filter(Boolean) as Card[];
    toSign.forEach((c) => {
      if (c.audio_url) ensureSigned(c.audio_url);
      if (c.image_url) ensureSigned(c.image_url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeck?.id, idx, queue.length]);

  const masteredCount = useMemo(
    () => Object.values(reviews).filter((r) => r.interval_days >= 21 && r.ease_factor >= 2.5).length,
    [reviews]
  );
  const totalReviews = Object.keys(reviews).length;

  const deckStats = (deckId: string) => {
    const cards = cardsByDeck[deckId] || [];
    const now = Date.now();
    let due = 0;
    let fresh = 0;
    let hard = 0;
    cards.forEach((c) => {
      const rv = reviews[c.id];
      if (!rv) fresh++;
      else if (new Date(rv.due_at).getTime() <= now) due++;
      if (rv && rv.lapses >= 2) hard++;
    });
    return { total: cards.length, due, fresh: Math.min(fresh, NEW_PER_DAY), hard };
  };

  const startDeck = (deck: Deck) => {
    const cards = cardsByDeck[deck.id] || [];
    const now = Date.now();
    const dueCards: Card[] = [];
    const newCards: Card[] = [];
    cards.forEach((c) => {
      const rv = reviews[c.id];
      if (!rv) newCards.push(c);
      else if (new Date(rv.due_at).getTime() <= now) dueCards.push(c);
    });
    // Prioritize cards with more lapses first (Foco no que é Difícil)
    dueCards.sort((a, b) => (reviews[b.id]?.lapses ?? 0) - (reviews[a.id]?.lapses ?? 0));
    const finalQ = [...dueCards, ...newCards.slice(0, NEW_PER_DAY)];
    if (finalQ.length === 0) {
      toast.info("Nenhuma carta pendente neste deck. Volte mais tarde!");
      return;
    }
    setActiveDeck(deck);
    setQueue(finalQ);
    setIdx(0);
    setShowBack(false);
    setSessionStats({ reviewed: 0, good: 0, easy: 0, again: 0, hard: 0 });
  };

  const closeDeck = () => {
    setActiveDeck(null);
    setQueue([]);
    setIdx(0);
    setShowBack(false);
    load();
  };

  const rate = async (rating: 1 | 2 | 3 | 4) => {
    if (busy) return;
    const card = queue[idx];
    if (!card) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_card_review", { _card_id: card.id, _rating: rating });
    setBusy(false);
    if (error) { toast.error(error.message); return; }

    const r = data as any;
    if (r?.xp_earned > 0) toast.success(`+${r.xp_earned} XP`);
    setReviews((prev) => ({
      ...prev,
      [card.id]: {
        card_id: card.id,
        due_at: r.due_at,
        interval_days: Number(r.interval_days),
        repetitions: r.repetitions,
        lapses: r.lapses,
        ease_factor: Number(r.ease_factor),
      },
    }));
    setSessionStats((s) => ({
      reviewed: s.reviewed + 1,
      again: s.again + (rating === 1 ? 1 : 0),
      hard: s.hard + (rating === 2 ? 1 : 0),
      good: s.good + (rating === 3 ? 1 : 0),
      easy: s.easy + (rating === 4 ? 1 : 0),
    }));

    // Re-queue "Novamente" cards at the end
    if (rating === 1) {
      setQueue((q) => [...q, card]);
    }
    setIdx((i) => i + 1);
    setShowBack(false);
  };

  const previewInterval = (rating: 1 | 2 | 3 | 4): string => {
    if (rating === 1) return "<1min";
    if (rating === 2) return "<1d";
    if (rating === 3) return "15d";
    return "90d";
  };

  // TTS: always speak only the front (EN), even when the back is revealed.
  const speakCard = (card: Card) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Seu navegador não suporta síntese de voz.");
      return;
    }
    window.speechSynthesis.cancel();
    if (!card.front_text?.trim()) return;
    const u = new SpeechSynthesisUtterance(card.front_text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  // ---------- Review mode ----------
  if (activeDeck) {
    const card = queue[idx];
    const done = !card;
    const progress = queue.length ? (Math.min(idx, queue.length) / queue.length) * 100 : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={closeDeck}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="text-xs text-muted-foreground">
            {Math.min(idx + (done ? 0 : 1), queue.length)} / {queue.length}
          </div>
        </div>
        <Progress value={progress} className="h-1.5" />

        {done ? (
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <Trophy className="h-6 w-6 text-primary" /> Sessão concluída!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{sessionStats.reviewed}</div>
                  <div className="text-xs text-muted-foreground">Revisadas</div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-700">
                  <div className="text-2xl font-bold text-neutral-100">{sessionStats.again}</div>
                  <div className="text-xs text-muted-foreground">Novamente</div>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10">
                  <div className="text-2xl font-bold text-red-600">{sessionStats.hard}</div>
                  <div className="text-xs text-muted-foreground">Difícil</div>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <div className="text-2xl font-bold text-yellow-600">{sessionStats.good}</div>
                  <div className="text-xs text-muted-foreground">Bom</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 col-span-2">
                  <div className="text-2xl font-bold text-green-600">{sessionStats.easy}</div>
                  <div className="text-xs text-muted-foreground">Fácil</div>
                </div>
              </div>
              <Button onClick={closeDeck} className="w-full">Concluir</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="min-h-[360px] flex flex-col">
            <CardContent className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
              {card.image_url && signedUrls[card.image_url] && (
                <img src={signedUrls[card.image_url]} alt="" className="max-h-32 rounded-md object-contain" />
              )}
              {!showBack ? (
                <Button variant="outline" size="lg" onClick={() => speakCard(card)}>
                  <Volume2 className="h-4 w-4 mr-2" /> Ouça e Repita
                </Button>
              ) : (
                <div className="w-full space-y-4 animate-fade-in">
                  <p className="text-2xl font-display font-semibold leading-snug">{card.front_text}</p>
                  <Button variant="outline" size="sm" onClick={() => speakCard(card)}>
                    <Volume2 className="h-4 w-4 mr-1" /> Ouvir
                  </Button>
                  <div className="w-full border-t pt-4 space-y-3">
                    <p className="text-lg text-primary font-medium">{card.back_text}</p>
                    {card.example_sentence && (
                      <p className="text-sm italic text-muted-foreground">"{card.example_sentence}"</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t">
              {!showBack ? (
                <Button className="w-full" size="lg" onClick={() => setShowBack(true)}>
                  Mostrar resposta
                </Button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100"
                    disabled={busy}
                    onClick={() => rate(1)}
                  >
                    <span className="font-semibold">Novamente</span>
                    <span className="text-[10px] opacity-70">{previewInterval(1)}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 border-red-500/50 hover:bg-red-500/10 text-red-600"
                    disabled={busy}
                    onClick={() => rate(2)}
                  >
                    <span className="font-semibold">Difícil</span>
                    <span className="text-[10px] opacity-70">{previewInterval(2)}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-600"
                    disabled={busy}
                    onClick={() => rate(3)}
                  >
                    <span className="font-semibold">Bom</span>
                    <span className="text-[10px] opacity-70">{previewInterval(3)}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 border-green-500/50 hover:bg-green-500/10 text-green-600"
                    disabled={busy}
                    onClick={() => rate(4)}
                  >
                    <span className="font-semibold">Fácil</span>
                    <span className="text-[10px] opacity-70">{previewInterval(4)}</span>
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ---------- Deck list ----------
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">IA Memorizaê</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Treino diário de flashcards com Repetição Espaçada (SRS). O algoritmo escolhe o momento perfeito para você
            revisar cada carta e destruir a Curva do Esquecimento — 5 a 10 minutos por dia bastam.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xl font-bold">{masteredCount}</div>
              <div className="text-[11px] text-muted-foreground">Cartas dominadas</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xl font-bold">{totalReviews}</div>
              <div className="text-[11px] text-muted-foreground">No seu deck</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Timer className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xl font-bold">
                {Object.values(reviews).filter((r) => new Date(r.due_at).getTime() <= Date.now()).length}
              </div>
              <div className="text-[11px] text-muted-foreground">Devidas agora</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xl font-bold">{decks.length}</div>
              <div className="text-[11px] text-muted-foreground">Decks disponíveis</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : decks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum deck disponível ainda. Volte em breve!
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="flex justify-center gap-2 flex-wrap">
          {LEVELS.map((lv) => (
            <Button
              key={lv}
              size="sm"
              variant={selectedLevel === lv ? "default" : "outline"}
              className="rounded-full w-11 h-11"
              onClick={() => setSelectedLevel(lv)}
            >
              {lv}
            </Button>
          ))}
        </div>
        {(() => {
          const filtered = decks.filter((d) => (d.course_id ? courseLevelById[d.course_id] === selectedLevel : false));
          if (filtered.length === 0) {
            return (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum deck disponível no nível {selectedLevel} ainda.
                </CardContent>
              </Card>
            );
          }
          return (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((d) => {
            const s = deckStats(d.id);
            const deckLevel = d.course_id ? courseLevelById[d.course_id] : null;
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{d.title}</CardTitle>
                    {deckLevel && <Badge variant="outline" className="text-[10px]">{deckLevel}</Badge>}
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{s.total} cartas</Badge>
                    {s.due > 0 && <Badge className="bg-primary text-primary-foreground">{s.due} devidas</Badge>}
                    {s.fresh > 0 && <Badge variant="outline">{s.fresh} novas</Badge>}
                    {s.hard > 0 && <Badge variant="destructive" className="text-[10px]">{s.hard} difíceis</Badge>}
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => startDeck(d)}
                    disabled={s.total === 0 || (s.due === 0 && s.fresh === 0)}
                  >
                    {s.total === 0 ? "Sem cartas" : s.due === 0 && s.fresh === 0 ? "Tudo em dia ✓" : "Começar treino"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
          );
        })()}
        </>
      )}
    </div>
  );
}