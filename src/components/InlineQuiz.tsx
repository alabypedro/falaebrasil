import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, RotateCcw, ArrowRight, HelpCircle, Star, BookOpen } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  display_order: number;
}

export default function InlineQuiz({ quizId }: { quizId: string }) {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<{ id: string; title: string; passing_score: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, { correct: boolean; correct_option_index: number }>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: q }, { data: qs }] = await Promise.all([
        supabase.from("quizzes").select("id, title, passing_score").eq("id", quizId).single(),
        supabase.from("quiz_questions_public" as any).select("*").eq("quiz_id", quizId).order("display_order"),
      ]);
      if (q) setQuiz(q);
      if (qs) setQuestions(qs.map((item: any) => ({ ...item, options: item.options as string[] })));
      setLoading(false);
    };
    load();
  }, [quizId]);

  const handleAnswer = (v: string) => setAnswers({ ...answers, [current]: parseInt(v) });

  const submit = async () => {
    if (!quiz || !user) return;
    const answersById: Record<string, number> = {};
    questions.forEach((q, i) => {
      if (answers[i] !== undefined) answersById[q.id] = answers[i];
    });
    const { data, error } = await supabase.rpc("submit_quiz" as any, {
      _quiz_id: quiz.id,
      _answers: answersById as any,
    });
    if (error) return;
    const r = data as any;
    const resultsMap: Record<string, { correct: boolean; correct_option_index: number }> = {};
    (r.results ?? []).forEach((res: any) => {
      resultsMap[res.question_id] = { correct: res.correct, correct_option_index: res.correct_option_index };
    });
    setResults(resultsMap);
    setScore(r.score ?? 0);
    setPassed(r.passed ?? false);
    setXpEarned(r.xp_earned ?? 0);
    setSubmitted(true);
  };

  const retry = () => {
    setAnswers({});
    setCurrent(0);
    setSubmitted(false);
    setResults({});
  };

  if (loading) return null;
  if (!quiz || questions.length === 0) return null;

  if (submitted) {
    const correctCount = Object.values(results).filter((r) => r.correct).length;
    const wrongCount = questions.length - correctCount;
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {passed ? <CheckCircle className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
            <CardTitle className="text-base">{passed ? "Parabéns! Você passou! 🎉" : "Tente novamente"}</CardTitle>
          </div>
          <CardDescription>Nota: {score}% — Mínimo: {quiz.passing_score}%</CardDescription>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className="rounded bg-emerald-500/10 text-emerald-600 px-2 py-0.5">✓ {correctCount}</span>
            <span className="rounded bg-destructive/10 text-destructive px-2 py-0.5">✗ {wrongCount}</span>
          </div>
          {passed && xpEarned > 0 && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-500">
              <Star className="h-4 w-4 fill-amber-500" />+{xpEarned} XP conquistados!
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={score} className="h-2" />
          {!passed && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs flex gap-2 items-start">
              <BookOpen className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">Revise a videoaula desta unidade e tente novamente para ganhar XP.</span>
            </div>
          )}
          {questions.map((q, i) => {
            const r = results[q.id];
            const isCorrect = r?.correct ?? false;
            const correctIdx = r?.correct_option_index ?? -1;
            return (
              <div key={q.id} className={`rounded-md border p-2.5 text-sm ${isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                <div className="flex items-start gap-2">
                  {isCorrect ? <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                  <span>{i + 1}. {q.question_text}</span>
                </div>
                <div className="ml-5 mt-1 space-y-0.5 text-xs">
                  <p>
                    <span className="text-muted-foreground">Sua: </span>
                    <span className={isCorrect ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                      {q.options[answers[i]] ?? "— (vazio)"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Correta: </span>
                    <span className="text-emerald-600 font-medium">{q.options[correctIdx] ?? "—"}</span>
                  </p>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={retry}><RotateCcw className="h-3.5 w-3.5 mr-1" />Tentar Novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const q = questions[current];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{quiz.title}</CardTitle>
          <Badge variant="secondary" className="ml-auto text-[10px]">{current + 1}/{questions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">{q.question_text}</p>
        <RadioGroup key={current} value={answers[current] !== undefined ? answers[current].toString() : ""} onValueChange={handleAnswer} className="space-y-2">
          {q.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border p-2.5 hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value={i.toString()} id={`iq-${i}`} />
              <Label htmlFor={`iq-${i}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
            </div>
          ))}
        </RadioGroup>
        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}>Anterior</Button>
          {current === questions.length - 1 ? (
            <Button size="sm" onClick={submit} disabled={Object.keys(answers).length < questions.length}>Finalizar</Button>
          ) : (
            <Button size="sm" onClick={() => setCurrent(current + 1)} disabled={answers[current] === undefined}>
              Próxima <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
