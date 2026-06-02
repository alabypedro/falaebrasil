import { useState, useEffect, useRef } from "react";
import { Send, Mic, Square, Loader2, Bot, User, MessageSquareText, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function WritingLab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'writing' | 'listening'>('writing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isRecording, startRecording, stopRecording, recordings } = useAudioRecorder();

  // Load or create session
  useEffect(() => {
    if (!user) return;
    
    const initSession = async () => {
      // Find active session or create new
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
        // Load messages
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || !sessionId || isLoading) return;

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
      // 1. Save user message
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: text
      });

      // 2. Call Edge Function
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

      // 3. Save bot message
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: botContent
      });

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

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat Lab</h1>
          <p className="text-muted-foreground">Pratique sua escrita e escuta com IA.</p>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="writing" className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              Writing
            </TabsTrigger>
            <TabsTrigger value="listening" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Listening
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-sidebar/50 backdrop-blur-sm border-sidebar-border/50">
        <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground space-y-2">
                <Bot className="h-12 w-12 opacity-20" />
                <p>Inicie uma conversa para começar a praticar!</p>
                <p className="text-xs max-w-xs">
                  {mode === 'writing' 
                    ? "Escreva qualquer coisa em inglês e eu corrigirei sua gramática."
                    : "Eu falarei com você e você pode responder por voz ou texto."}
                </p>
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
                  "rounded-2xl px-4 py-2 text-sm",
                  m.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-sidebar-accent/80 text-sidebar-foreground rounded-tl-none border border-sidebar-border/30"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
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
            <div className="relative flex-1">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={mode === 'writing' ? "Escreva aqui..." : "Ouça e responda..."}
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
