import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BookOpen, MessageSquareText, Mic, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface Challenge {
  id: string;
  mistake_type: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
  source_mode: string;
  occurrence_count: number;
}

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("fb_learning_challenges")
        .select("*")
        .eq("user_id", user.id)
        .order("occurrence_count", { ascending: false });
      if (data) setChallenges(data);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 mt-8">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto page-transition">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight">Meus Desafios</h1>
        <p className="text-muted-foreground mt-2">
          Acompanhe os erros mais recorrentes detectados pelas IAs e foque nos seus pontos de melhoria.
        </p>
      </div>

      {challenges.length === 0 ? (
        <Card className="border-dashed py-12 text-center animate-fade-in">
          <CardContent className="space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Você ainda não tem desafios registrados. Pratique nos Labs para gerar feedback!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {challenges.map((c, i) => (
            <Card 
              key={c.id} 
              className="animate-fade-up hover-lift border-border/50"
              style={{ "--delay": `${i * 100}ms` } as React.CSSProperties}
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  {c.source_mode === 'writing' ? <MessageSquareText className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4 text-accent" />}
                  <CardTitle className="text-sm font-semibold">{c.mistake_type}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {c.occurrence_count} ocorrência{c.occurrence_count > 1 ? 's' : ''}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Como você escreveu/falou:</p>
                    <p className="text-sm italic text-foreground">"{c.original_text}"</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-success uppercase tracking-wider">Forma correta:</p>
                    <p className="text-sm font-medium text-foreground">"{c.corrected_text}"</p>
                  </div>
                </div>
                {c.explanation && (
                  <div className="flex gap-2 p-3 rounded-lg bg-accent/5 border border-accent/10">
                    <AlertCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-accent">Explicação:</span> {c.explanation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}