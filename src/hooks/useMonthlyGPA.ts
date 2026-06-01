import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MonthlyGPA {
  gpa: number | null;           // 0-100 monthly average
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

export function useMonthlyGPA(userId: string | undefined): MonthlyGPA {
  const [state, setState] = useState<MonthlyGPA>({
    gpa: null, letter: "—", gpaPoints: null,
    quizAvg: null, bestScripted: null, bestUnscripted: null,
    componentsCount: 0, loading: true,
  });

  useEffect(() => {
    if (!userId) { setState((s) => ({ ...s, loading: false })); return; }
    const load = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [{ data: quizzes }, { data: voices }] = await Promise.all([
        supabase.from("quiz_attempts").select("quiz_id, score, created_at").eq("user_id", userId).gte("created_at", monthStart).order('created_at', { ascending: false }),
        supabase.from("voice_sessions").select("mode, accuracy_score, fluency_score, prosody_score, created_at").eq("user_id", userId).gte("created_at", monthStart),
      ]);

      // Use a Map to keep only the most recent attempt per quiz_id
      const latestQuizzes = new Map<string, number>();
      (quizzes ?? []).forEach((q: any) => {
        if (!latestQuizzes.has(q.quiz_id)) {
          latestQuizzes.set(q.quiz_id, Number(q.score));
        }
      });

      const quizScores = Array.from(latestQuizzes.values()).filter((n) => !isNaN(n));
      const quizAvg = quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : null;

      const voiceAvg = (v: any): number | null => {
        // Average of accuracy, fluency and prosody
        const parts = [
          v.accuracy_score,
          v.fluency_score,
          v.prosody_score,
        ].filter((x) => typeof x === "number");
        if (!parts.length) return null;
        const avg = parts.reduce((a: number, b: number) => a + b, 0) / parts.length;
        // Match VoiceLab rounding logic: Math.round(value * 10) / 10
        return Math.round(avg * 10) / 10;
      };

      const scriptedScores = (voices ?? []).filter((v: any) => v.mode === "scripted").map(voiceAvg).filter((n): n is number => n !== null);
      const unscriptedScores = (voices ?? []).filter((v: any) => v.mode === "unscripted").map(voiceAvg).filter((n): n is number => n !== null);

      const bestScripted = scriptedScores.length ? Math.max(...scriptedScores) : null;
      const bestUnscripted = unscriptedScores.length ? Math.max(...unscriptedScores) : null;

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