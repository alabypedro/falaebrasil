import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ScoreCircle from "@/components/ScoreCircle";

export interface FeedbackScores {
  pronunciation: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
}

interface FeedbackCardProps {
  scores: FeedbackScores | null;
  suggestions?: string[];
}

export default function FeedbackCard({ scores, suggestions }: FeedbackCardProps) {
  if (!scores) {
    return (
      <Card className="border-dashed animate-fade-in">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 h-16 w-16 rounded-full bg-muted flex items-center justify-center animate-float">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Grave um áudio para receber seu feedback de pronúncia
          </p>
        </CardContent>
      </Card>
    );
  }

  const avg = Math.round(
    (scores.pronunciation + scores.fluency + scores.grammar + scores.vocabulary) / 4
  );

  return (
    <Card className="animate-scale-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Feedback de Pronúncia</span>
          <span className="text-2xl font-bold text-accent animate-xp-pop">{avg}/100</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ScoreCircle label="Pronúncia" score={scores.pronunciation} color="hsl(var(--accent))" />
          <ScoreCircle label="Fluência" score={scores.fluency} color="hsl(var(--success))" />
          <ScoreCircle label="Gramática" score={scores.grammar} color="hsl(var(--innovation))" />
          <ScoreCircle label="Vocabulário" score={scores.vocabulary} color="hsl(var(--xp))" />
        </div>

        {suggestions && suggestions.length > 0 && (
          <div className="rounded-lg bg-secondary p-4 space-y-2 animate-fade-up" style={{ "--delay": "300ms" } as React.CSSProperties}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sugestões de Melhoria
            </p>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="text-sm text-foreground flex items-start gap-2 animate-fade-up"
                  style={{ "--delay": `${350 + i * 60}ms` } as React.CSSProperties}
                >
                  <span className="text-accent mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
