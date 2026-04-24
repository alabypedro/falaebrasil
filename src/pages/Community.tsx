import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Hash, Send, Mic, Square, Trash2, Loader2, Users } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  level: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  message_type: "text" | "audio";
  content: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  created_at: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getInitials(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  return name.trim().slice(0, 2).toUpperCase();
}

export default function Community() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isRecording,
    recordings,
    elapsed,
    audioLevel,
    startRecording,
    stopRecording,
    deleteRecording,
  } = useAudioRecorder();

  const pendingRecording = recordings[0];
  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId]
  );

  // Group channels by level (community)
  const channelsByLevel = useMemo(() => {
    const groups: Record<string, Channel[]> = {};
    for (const c of channels) {
      const lvl = (c.level || "A1").toUpperCase();
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(c);
    }
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
    return order
      .filter((lvl) => groups[lvl]?.length)
      .map((lvl) => ({ level: lvl, channels: groups[lvl] }));
  }, [channels]);

  // Load channels
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("community_channels")
        .select("*")
        .order("display_order");
      if (error) {
        toast.error("Erro ao carregar canais.");
        return;
      }
      const list = (data as Channel[]) || [];
      setChannels(list);
      if (list.length && !activeChannelId) setActiveChannelId(list[0].id);
    })();
  }, []);

  // Load messages + realtime sub for active channel
  useEffect(() => {
    if (!activeChannelId) return;
    let cancelled = false;

    const loadMessages = async () => {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from("community_messages")
        .select("*")
        .eq("channel_id", activeChannelId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        toast.error("Erro ao carregar mensagens.");
        setLoadingMessages(false);
        return;
      }
      const msgs = (data as Message[]) || [];
      setMessages(msgs);
      setLoadingMessages(false);
      await loadProfilesFor(msgs);
      await loadAudioUrlsFor(msgs);
      requestAnimationFrame(scrollToBottom);
    };

    loadMessages();

    const channel = supabase
      .channel(`community_messages:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
          );
          await loadProfilesFor([newMsg]);
          await loadAudioUrlsFor([newMsg]);
          requestAnimationFrame(scrollToBottom);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "community_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          const oldMsg = payload.old as Message;
          setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  const loadProfilesFor = async (msgs: Message[]) => {
    const missing = Array.from(
      new Set(msgs.map((m) => m.user_id).filter((id) => id && !profiles[id]))
    );
    if (!missing.length) return;
    const { data } = await supabase
      .from("profiles_public")
      .select("user_id, display_name, avatar_url")
      .in("user_id", missing);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data as Profile[]) {
          if (p.user_id) next[p.user_id] = p;
        }
        return next;
      });
    }
  };

  const loadAudioUrlsFor = async (msgs: Message[]) => {
    const audioMsgs = msgs.filter(
      (m) => m.message_type === "audio" && m.audio_url && !audioUrls[m.id]
    );
    if (!audioMsgs.length) return;
    const updates: Record<string, string> = {};
    await Promise.all(
      audioMsgs.map(async (m) => {
        const { data } = await supabase.storage
          .from("community-audio")
          .createSignedUrl(m.audio_url!, 60 * 60);
        if (data?.signedUrl) updates[m.id] = data.signedUrl;
      })
    );
    if (Object.keys(updates).length) {
      setAudioUrls((prev) => ({ ...prev, ...updates }));
    }
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const sendText = async () => {
    const trimmed = textInput.trim();
    if (!trimmed || !user || !activeChannelId) return;
    setSending(true);
    const { error } = await supabase.from("community_messages").insert({
      channel_id: activeChannelId,
      user_id: user.id,
      message_type: "text",
      content: trimmed,
    });
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar mensagem.");
      return;
    }
    setTextInput("");
  };

  const sendAudio = async () => {
    if (!pendingRecording || !user || !activeChannelId) return;
    setUploadingAudio(true);
    try {
      const path = `${user.id}/${Date.now()}_${crypto.randomUUID()}.wav`;
      const { error: upErr } = await supabase.storage
        .from("community-audio")
        .upload(path, pendingRecording.blob, { contentType: "audio/wav" });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("community_messages").insert({
        channel_id: activeChannelId,
        user_id: user.id,
        message_type: "audio",
        audio_url: path,
        audio_duration_seconds: pendingRecording.duration,
      });
      if (insErr) throw insErr;

      deleteRecording(pendingRecording.id);
    } catch (err: any) {
      toast.error("Erro ao enviar áudio: " + (err?.message ?? "tente novamente"));
    } finally {
      setUploadingAudio(false);
    }
  };

  const deleteMessage = async (msg: Message) => {
    const { error } = await supabase
      .from("community_messages")
      .delete()
      .eq("id", msg.id);
    if (error) {
      toast.error("Não foi possível apagar a mensagem.");
      return;
    }
    if (msg.message_type === "audio" && msg.audio_url && msg.user_id === user?.id) {
      // best-effort cleanup
      await supabase.storage.from("community-audio").remove([msg.audio_url]);
    }
  };

  return (
    <div className="page-transition flex h-[calc(100vh-8rem)] gap-4">
      {/* Channels sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col rounded-lg border bg-card md:flex">
        <div className="border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" />
            Comunidade
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Canais por tema
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-2">
            {channelsByLevel.map((group) => (
              <div key={group.level}>
                <div className="flex items-center gap-2 px-2 pb-1 pt-1">
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {group.level}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Comunidade {group.level}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {group.channels.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setActiveChannelId(c.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          c.id === activeChannelId
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground/80"
                        )}
                      >
                        <Hash className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {channels.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Nenhuma comunidade disponível para o seu nível ainda. Continue
                evoluindo para desbloquear!
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <section className="flex flex-1 flex-col rounded-lg border bg-card">
        {/* Channel header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-base font-semibold">
              <Hash className="h-4 w-4 text-muted-foreground" />
              {activeChannel?.name ?? "Selecione um canal"}
            </h1>
            {activeChannel?.description && (
              <p className="truncate text-xs text-muted-foreground">
                {activeChannel.description}
              </p>
            )}
          </div>
          {/* Mobile channel selector */}
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm md:hidden"
            value={activeChannelId}
            onChange={(e) => setActiveChannelId(e.target.value)}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Hash className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                Bem-vindo a #{activeChannel?.name}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Seja o primeiro a enviar uma mensagem neste canal.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => {
                const profile = profiles[m.user_id];
                const isMine = m.user_id === user?.id;
                const canDelete = isMine || isAdmin;
                const displayName =
                  profile?.display_name || (isMine ? "Você" : "Aluno");
                return (
                  <li key={m.id} className="group flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            isMine ? "text-primary" : "text-foreground"
                          )}
                        >
                          {displayName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatTime(new Date(m.created_at))}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => deleteMessage(m)}
                            className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Apagar mensagem"
                            title="Apagar mensagem"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                      </div>
                      {m.message_type === "text" ? (
                        <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                          {m.content}
                        </p>
                      ) : (
                        <div className="mt-1 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
                          {audioUrls[m.id] ? (
                            <audio
                              controls
                              src={audioUrls[m.id]}
                              className="h-8 max-w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Carregando áudio…
                            </div>
                          )}
                          {m.audio_duration_seconds && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatDuration(m.audio_duration_seconds)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Composer */}
        <div className="border-t p-3">
          {pendingRecording && !uploadingAudio && (
            <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
              <audio controls src={pendingRecording.url} className="h-8 flex-1" />
              <span className="text-xs text-muted-foreground">
                {formatDuration(pendingRecording.duration)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteRecording(pendingRecording.id)}
                aria-label="Descartar áudio"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button size="sm" onClick={sendAudio}>
                <Send className="h-4 w-4 mr-1" /> Enviar áudio
              </Button>
            </div>
          )}

          {isRecording && (
            <div className="mb-2 flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              <span className="text-sm font-medium text-destructive">
                Gravando… {formatDuration(elapsed)}
              </span>
              <div className="ml-2 h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${Math.min(100, audioLevel)}%` }}
                />
              </div>
              <Button size="sm" variant="destructive" onClick={stopRecording}>
                <Square className="h-4 w-4 mr-1" /> Parar
              </Button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isRecording
                  ? "Termine a gravação para digitar…"
                  : `Mensagem em #${activeChannel?.name ?? "..."}`
              }
              disabled={isRecording || !activeChannelId}
              className="flex-1"
            />
            {textInput.trim() ? (
              <Button type="submit" size="icon" disabled={sending || !activeChannelId}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant={isRecording ? "destructive" : "default"}
                disabled={!activeChannelId || uploadingAudio || !!pendingRecording}
                onClick={() => (isRecording ? stopRecording() : startRecording())}
                aria-label={isRecording ? "Parar gravação" : "Gravar áudio"}
              >
                {isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
          </form>
          {uploadingAudio && (
            <p className="mt-1 text-[11px] text-muted-foreground">Enviando áudio…</p>
          )}
        </div>
      </section>
    </div>
  );
}
