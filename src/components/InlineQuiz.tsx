import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, RotateCcw, ArrowRight, HelpCircle, Star } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
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

  useEffect(() => {
    const load = async () => {
      const [{ data: q }, { data: qs }] = await Promise.all([
        supabase.from("quizzes").select("id, title, passing_score").eq("id", quizId).single(),
        supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("display_order"),
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
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct_option_index) correct++; });
    const s = Math.round((correct / questions.length) * 100);
    const p = s >= quiz.passing_score;
    setScore(s);
    setPassed(p);
    setSubmitted(true);
    await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      score: s,
      passed: p,
      answers: answers as any,
    });

    // Gamification: award XP when passed
    if (p) {
      const xpEarned = Math.round(s / 10) * 5; // 35-50 XP based on score
      const { data: profile } = await supabase
        .from("profiles")
        .select("xp, level")
        .eq("user_id", user.id)
        .single();
      if (profile) {
        const newXp = (profile.xp || 0) + xpEarned;
        // Level up thresholds
        let newLevel = profile.level;
        if (newXp >= 5000) newLevel = "B2";
        else if (newXp >= 2500) newLevel = "B1";
        else if (newXp >= 1000) newLevel = "A2";
        else newLevel = "A1";
        await supabase
          .from("profiles")
          .update({ xp: newXp, level: newLevel })
          .eq("user_id", user.id);
        setXpEarned(xpEarned);
      }
    }
  };

  const retry = () => {
    setAnswers({});
    setCurrent(0);
    setSubmitted(false);
  };

  if (loading) return null;
  if (!quiz || questions.length === 0) return null;

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {passed ? <CheckCircle className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
            <CardTitle className="text-base">{passed ? "Parabéns! Você passou! 🎉" : "Tente novamente"}</CardTitle>
          </div>
          <CardDescription>Nota: {score}% — Mínimo: {quiz.passing_score}%</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={score} className="h-2" />
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correct_option_index;
            return (
              <div key={q.id} className="rounded-md border p-2.5 text-sm">
                <div className="flex items-start gap-2">
                  {isCorrect ? <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                  <span>{q.question_text}</span>
                </div>
                {!isCorrect && (
                  <p className="text-xs text-muted-foreground ml-5 mt-1">
                    Sua: <span className="text-destructive">{q.options[answers[i]] ?? "—"}</span> · Correta: <span className="text-success">{q.options[q.correct_option_index]}</span>
                  </p>
                )}
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
        <RadioGroup value={answers[current]?.toString()} onValueChange={handleAnswer} className="space-y-2">
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
