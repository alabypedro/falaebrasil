import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, ArrowRight, RotateCcw } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  display_order: number;
}

export default function QuizPlayer() {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<{ id: string; title: string; passing_score: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, { correct: boolean; correct_option_index: number }>>({});

  useEffect(() => {
    if (!quizId) return;
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

  const handleAnswer = (optionIndex: string) => {
    setAnswers({ ...answers, [current]: parseInt(optionIndex) });
  };

  const next = () => {
    if (current < questions.length - 1) setCurrent(current + 1);
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const submit = async () => {
    if (!quiz || !user) return;
    // Build answers keyed by question id (server expects question_id -> selected index)
    const answersById: Record<string, number> = {};
    questions.forEach((q, i) => {
      if (answers[i] !== undefined) answersById[q.id] = answers[i];
    });

    const { data, error } = await supabase.rpc("submit_quiz" as any, {
      _quiz_id: quiz.id,
      _answers: answersById as any,
    });
    if (error) {
      toast.error("Erro ao enviar quiz: " + error.message);
      return;
    }
    const r = data as any;
    const resultsMap: Record<string, { correct: boolean; correct_option_index: number }> = {};
    (r.results ?? []).forEach((res: any) => {
      resultsMap[res.question_id] = { correct: res.correct, correct_option_index: res.correct_option_index };
    });
    setResults(resultsMap);
    setScore(r.score ?? 0);
    setPassed(r.passed ?? false);
    setSubmitted(true);
  };

  const retry = () => {
    setAnswers({});
    setCurrent(0);
    setSubmitted(false);
    setScore(0);
    setPassed(false);
    setResults({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quiz não encontrado ou sem perguntas.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <Card className="text-center">
          <CardHeader>
            {passed ? (
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-2" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-2" />
            )}
            <CardTitle className="text-2xl">
              {passed ? "Parabéns! Você passou! 🎉" : "Não foi dessa vez..."}
            </CardTitle>
            <CardDescription>
              Sua nota: <span className="font-bold text-foreground">{score}%</span> — Mínimo: {quiz.passing_score}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={score} className="h-3" />

            <div className="space-y-3 text-left">
              {questions.map((q, i) => {
                const isCorrect = answers[i] === q.correct_option_index;
                return (
                  <div key={q.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                      <p className="text-sm font-medium">{q.question_text}</p>
                    </div>
                    {!isCorrect && (
                      <p className="text-xs text-muted-foreground ml-6">
                        Sua resposta: <span className="text-destructive">{q.options[answers[i]] ?? "—"}</span> · Correta: <span className="text-emerald-600">{q.options[q.correct_option_index]}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={retry}><RotateCcw className="h-4 w-4 mr-1" />Tentar Novamente</Button>
              <Button onClick={() => navigate(-1)}>Voltar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">{quiz.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Progress value={progress} className="h-2 flex-1" />
          <Badge variant="secondary" className="text-xs">{current + 1}/{questions.length}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{q.question_text}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={answers[current]?.toString()} onValueChange={handleAnswer} className="space-y-3">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value={oIdx.toString()} id={`opt-${oIdx}`} />
                <Label htmlFor={`opt-${oIdx}`} className="flex-1 cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prev} disabled={current === 0}>Anterior</Button>
        {current === questions.length - 1 ? (
          <Button onClick={submit} disabled={Object.keys(answers).length < questions.length}>
            Finalizar Quiz
          </Button>
        ) : (
          <Button onClick={next} disabled={answers[current] === undefined}>
            Próxima <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
