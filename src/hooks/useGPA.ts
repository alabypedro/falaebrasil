import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GPAData {
  gpa: number | null;           // 0-100 overall average
  letter: string;               // A/B/C/—
  gpaPoints: number | null;     // 4.0/3.0/2.0/null
  quizAvg: number | null;
  bestScripted: number | null;
  bestUnscripted: number | null;
  componentsCount: number;
  loading: boolean;
}

function letterFor(score: number): { letter: string; points: number | null } {
  if (score >= 90) return { letter: "A", points: 4.0 };
  if (score >= 80) return { letter: "B", points: 3.0 };
  if (score >= 70) return { letter: "C", points: 2.0 };
  return { letter: "—", points: null };
}

export function useGPA(userId: string | undefined): GPAData {
  const [state, setState] = useState<GPAData>({
    gpa: null, letter: "—", gpaPoints: null,
    quizAvg: null, bestScripted: null, bestUnscripted: null,
    componentsCount: 0, loading: true,
  });

  useEffect(() => {
    if (!userId) { setState((s) => ({ ...s, loading: false })); return; }
    
    const load = async () => {
      // Fetch quiz attempts and high scores from profile in parallel
      // We removed the date filter to make the GPA "eternal" as requested
      const [{ data: quizzes }, { data: profile }] = await Promise.all([
        supabase
          .from("quiz_attempts")
          .select("quiz_id, score, created_at")
          .eq("user_id", userId)
          .order('created_at', { ascending: false }),
        supabase
          .from("profiles")
          .select("best_scripted_score, best_unscripted_score")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      // Calculate Quiz Average (latest attempt per quiz_id)
      const latestQuizzes = new Map<string, number>();
      (quizzes ?? []).forEach((q: any) => {
        if (!latestQuizzes.has(q.quiz_id)) {
          latestQuizzes.set(q.quiz_id, Number(q.score));
        }
      });

      const quizScores = Array.from(latestQuizzes.values()).filter((n) => !isNaN(n));
      const quizAvg = quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : null;

      // Use the registered high scores from the profile
      const bestScripted = profile?.best_scripted_score || null;
      const bestUnscripted = profile?.best_unscripted_score || null;

      // GPA calculation: (QuizAvg + BestScripted + BestUnscripted) / componentsPresent
      const components = [quizAvg, bestScripted, bestUnscripted].filter((n): n is number => n !== null);
      const gpa = components.length ? components.reduce((a, b) => a + b, 0) / components.length : null;
      const { letter, points } = gpa !== null ? letterFor(gpa) : { letter: "—", points: null };

      setState({
        gpa,
        letter,
        gpaPoints: points,
        quizAvg,
        bestScripted,
        bestUnscripted,
        componentsCount: components.length,
        loading: false,
      });
    };

    load();
  }, [userId]);

  return state;
}
