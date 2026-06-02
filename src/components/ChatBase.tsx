import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Mic, Square, Loader2, Bot, User, MessageSquareText, Headphones, Volume2, Pause, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export default function ChatBase({ mode, title, description }: { mode: 'writing' | 'listening', title: string, description: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [recentTopics, setRecentTopics] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('A1');

  const levels = {
    'A1': 100,
    'A2': 150,
    'B1': 200,
    'B2': 250,
    'C1': 300,
    'C2': 350
  };

  const { isRecording, startRecording, stopRecording, recordings } = useAudioRecorder();

  useEffect(() => {
    if (!user) return;
    
    const initSession = async () => {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', mode)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (session) {
        setSessionId(session.id);
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });
        
        if (msgs) {
          setMessages(msgs.map(m => ({
            ...m,
            role: m.role as 'user' | 'assistant'
          })));
        }
      } else {
        const { data: newSession } = await supabase
          .from('chat_sessions')
          .insert({ user_id: user.id, type: mode })
          .select()
          .single();
        
        if (newSession) setSessionId(newSession.id);
      }
    };

    initSession();
  }, [user, mode]);

  const fetchWritingTopic = useCallback(async () => {
    if (mode !== 'writing') return;
    setTopicLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-writing-topic", {
        body: { recent: recentTopics.slice(0, 6) },
      });
      if (error) throw error;
      const topic = data?.topic;
      if (topic) {
        setCurrentTopic(topic);
        setRecentTopics((prev) => [topic, ...prev.filter((t) => t !== topic)].slice(0, 8));
      }
    } catch (e) {
      console.error("Failed to fetch writing topic", e);
    } finally {
      setTopicLoading(false);
    }
  }, [mode, recentTopics]);

  useEffect(() => {
    if (mode === 'writing' && !currentTopic && !topicLoading) {
      fetchWritingTopic();
    }
  }, [mode, currentTopic, topicLoading, fetchWritingTopic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (!text.trim() || !sessionId || isLoading) return;
    
    if (mode === 'writing' && wordCount > 100) {
      toast({
        title: "Limite de palavras excedido",
        description: "O texto no Escrevaê deve ter no máximo 100 palavras.",
        variant: "destructive"
      });
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: text
      });

      const { data, error } = await supabase.functions.invoke('writing-listening-chat', {
        body: { 
          messages: messages.concat(userMessage).map(m => ({ role: m.role, content: m.content })),
          type: mode
        }
      });

      if (error) throw error;

      const botContent = data.choices[0].message.content;
      const botMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: botContent,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);

      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: botContent
      });
      
      if (mode === 'listening') {
        speakMessage(botContent, botMessage.id);
      }

    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Erro no chat",
        description: "Não foi possível enviar sua mensagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioSubmit = async (audioBlob: Blob) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      formData.append("language", "en-US");
      formData.append("mode", "unscripted");

      const { data, error } = await supabase.functions.invoke("azure-pronunciation", { body: formData });
      if (error) throw error;

      if (data?.transcription) {
        handleSend(data.transcription);
      } else {
        toast({
          title: "Áudio não reconhecido",
          description: "Não conseguimos entender o que você disse. Tente falar mais perto do microfone.",
        });
      }
    } catch (error) {
      console.error("STT Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (recordings.length > 0 && !isLoading) {
      handleAudioSubmit(recordings[recordings.length - 1].blob);
    }
  }, [recordings]);

  const initChat = async () => {
    if (messages.length === 0 && sessionId && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('writing-listening-chat', {
          body: { 
            messages: [{ role: 'user', content: 'Inicie o exercício.' }],
            type: mode
          }
        });
        if (error) throw error;
        const botContent = data.choices[0].message.content;
        const botMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: botContent,
          created_at: new Date().toISOString()
        };
        setMessages([botMessage]);
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: botContent
        });
        if (mode === 'listening') {
          speakMessage(botContent, botMessage.id);
        }
      } catch (error) {
        console.error("Init chat error:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (sessionId && messages.length === 0) {
      initChat();
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [sessionId]);

  const speakMessage = async (text: string, messageId?: string) => {
    try {
      // Se já estiver falando o mesmo texto, apenas alternar pause
      if (currentSpeakingId === messageId && isSpeaking) {
        if (isPaused) {
          window.speechSynthesis.resume();
          setIsPaused(false);
        } else {
          window.speechSynthesis.pause();
          setIsPaused(true);
        }
        return;
      }

      // Se estiver falando outro texto, cancelar o anterior
      window.speechSynthesis.cancel();
      setIsPaused(false);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoices = [
        "Google US English",
        "Microsoft Aria Online",
        "Microsoft Guy Online",
        "Samantha",
        "Daniel"
      ];

      let selectedVoice = voices.find(v => v.lang === "en-US" && preferredVoices.some(pv => v.name.includes(pv)));
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith("en"));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (messageId) setCurrentSpeakingId(messageId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentSpeakingId(null);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentSpeakingId(null);
      };
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Speech error:", error);
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentSpeakingId(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {mode === 'writing' && (
        <Card className="mb-6 bg-accent/5 border-accent/20">
          <div className="p-6 text-center space-y-3">
            <p className="text-xs text-accent font-semibold uppercase tracking-wide">Tema Sugerido</p>
            {topicLoading ? (
              <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Gerando tema com IA…</span>
              </div>
            ) : (
              <p className="text-lg font-medium text-foreground">{currentTopic || "Carregando tema..."}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchWritingTopic()}
              disabled={topicLoading}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Novo tema
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex-1 overflow-hidden flex flex-col bg-sidebar/50 backdrop-blur-sm border-sidebar-border/50">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground space-y-2">
                <Bot className="h-12 w-12 opacity-20" />
                <p>Inicie uma conversa para começar a praticar!</p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-soft-sm",
                  m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-primary"
                )}>
                  {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn(
                  "rounded-2xl px-4 py-2 text-sm relative group",
                  m.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-sidebar-accent/80 text-sidebar-foreground rounded-tl-none border border-sidebar-border/30"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.role === 'assistant' && (
                    <button 
                      onClick={() => speakMessage(m.content, m.id)}
                      className={cn(
                        "absolute -right-8 top-1 transition-opacity p-1 hover:text-primary",
                        currentSpeakingId === m.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                      title={currentSpeakingId === m.id && isSpeaking ? (isPaused ? "Retomar" : "Pausar") : "Ouvir"}
                    >
                      {currentSpeakingId === m.id && isSpeaking ? (
                        isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 mr-auto">
                <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center animate-pulse">
                  <Bot className="h-4 w-4 text-sidebar-primary" />
                </div>
                <div className="bg-sidebar-accent/50 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-sidebar-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-sidebar-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-sidebar-primary/40 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-sidebar-border/30 bg-sidebar/30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 flex flex-col gap-1">
              <div className="relative">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={mode === 'writing' ? "Escreva seu texto (máx 100 palavras)..." : "Escreva algo..."}
                  disabled={isLoading}
                  className="pr-10 bg-background/50 border-sidebar-border/50 focus-visible:ring-sidebar-primary"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isRecording ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={stopRecording}
                      className="h-7 w-7 text-destructive animate-pulse"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => startRecording()}
                      disabled={isLoading}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {mode === 'writing' && (
                <div className={cn(
                  "text-[10px] self-end px-1",
                  inputText.trim().split(/\s+/).filter(Boolean).length > 100 ? "text-destructive font-bold" : "text-muted-foreground"
                )}>
                  {inputText.trim().split(/\s+/).filter(Boolean).length}/100 palavras
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              size="icon" 
              disabled={!inputText.trim() || isLoading}
              className="shrink-0 shadow-soft-sm"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
