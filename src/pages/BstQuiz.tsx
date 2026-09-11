import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, HelpCircle, Loader2 } from "lucide-react";
import InlineQuiz from "@/components/InlineQuiz";

interface BstQuizRow {
  id: string;
  title: string;
  level: string;
  passing_score: number;
  display_order: number;
  unit: number | null;
}

export default function BstQuiz({ bstProductId, level, unit }: { bstProductId: string; level?: string; unit?: number }) {
  const [quizzes, setQuizzes] = useState<BstQuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BstQuizRow | null>(null);
  const [ctx, setCtx] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("quizzes")
        .select("id,title,level,passing_score,display_order,unit")
        .eq("bst_product_id", bstProductId);
      if (level) query = query.eq("level", level);
      if (unit) query = query.eq("unit", unit);
      const { data } = await query
        .order("display_order")
        .order("title");
      setQuizzes((data as any as BstQuizRow[]) || []);
      setLoading(false);
    })();
  }, [bstProductId, level, unit]);

  // Texto do IA Leiaê vinculado ao mesmo produto/nível/unidade do quiz ativo
  useEffect(() => {
    if (!active) {
      setCtx(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("leiae_texts")
        .select("title,content,display_order")
        .eq("bst_product_id", bstProductId)
        .eq("level", active.level);
      if (active.unit) q = q.eq("unit", active.unit);
      const { data } = await q.order("display_order").limit(1);
      const row = ((data as any[]) ?? [])[0];
      if (!cancelled) {
        setCtx(row ? { title: row.title, content: row.content } : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, bstProductId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (active) {
    const idx = quizzes.findIndex((q) => q.id === active.id);
    const next = quizzes[idx + 1];
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => setActive(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Todos os quizzes
        </Button>
        <InlineQuiz
          quizId={active.id}
          hasNext={!!next}
          onNext={() => setActive(next ?? null)}
          contextText={ctx?.content ?? null}
          contextTitle={ctx?.title ?? null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" /> Quizz
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {unit ? `Unit ${unit} — ` : ""}Teste seus conhecimentos deste guia. Cada quiz vale XP ao atingir a nota mínima.
        </p>
      {/* quizzes exibidos agrupados por unidade */}
      </div>

      {quizzes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {unit ? `Nenhum quiz disponível na Unit ${unit} ainda.` : "Nenhum quiz disponível neste produto ainda."}
        </CardContent></Card>
      ) : (
        <ol className="space-y-2">
          {quizzes.map((q, i) => (
            <li key={q.id}>
              <button
                onClick={() => setActive(q)}
                className="w-full flex items-center gap-4 rounded-lg border bg-card p-4 text-left hover:border-primary hover:bg-muted/40 transition"
              >
                <span className="text-sm font-mono text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{q.title}</span>
                  <span className="block text-xs text-muted-foreground">Nota mínima: {q.passing_score}%</span>
                </span>
                <Badge variant="outline" className="shrink-0">{q.level}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
