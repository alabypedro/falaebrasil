import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ScoreCircle from "@/components/ScoreCircle";

export interface FeedbackScores {
  pronunciation: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  // Extended Azure fields
  status?: string;
  transcription?: string;
  confidence?: number;
  snr?: number | null;
  completeness?: number;
  prosody?: number;
  pronScore?: number;
}

interface FeedbackCardProps {
  scores: FeedbackScores | null;
  suggestions?: string[];
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-xp";
  return "text-destructive";
}

function getSnrLabel(snr: number) {
  if (snr >= 25) return { label: "Excelente", color: "text-success" };
  if (snr >= 15) return { label: "Bom", color: "text-xp" };
  return { label: "Baixo", color: "text-destructive" };
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

  const overall = scores.pronScore ?? Math.round(
    (scores.pronunciation + scores.fluency + scores.grammar + scores.vocabulary) / 4
  );

  return (
    <Card className="animate-scale-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Feedback de Pronúncia</span>
          <span className={`text-2xl font-bold animate-xp-pop ${getScoreColor(overall)}`}>{overall}/100</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status & metadata row */}
        <div className="flex flex-wrap gap-2 items-center">
          {scores.status && (
            <Badge variant="outline" className="gap-1 text-xs">
              ✅ {scores.status}
            </Badge>
          )}
          {scores.confidence != null && (
            <Badge variant="secondary" className="gap-1 text-xs">
              🎯 Confiança: {scores.confidence}%
            </Badge>
          )}
          {scores.snr != null && (
            <Badge variant="secondary" className={`gap-1 text-xs ${getSnrLabel(scores.snr).color}`}>
              🔊 SNR: {scores.snr} dB — {getSnrLabel(scores.snr).label}
            </Badge>
          )}
        </div>

        {/* Transcription */}
        {scores.transcription && (
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Texto reconhecido</p>
            <p className="text-sm text-foreground font-medium">"{scores.transcription}"</p>
          </div>
        )}

        {/* Score circles */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <ScoreCircle label="Pronúncia" score={scores.pronunciation} />
          <ScoreCircle label="Fluência" score={scores.fluency} />
          <ScoreCircle label="Completude" score={scores.completeness ?? scores.grammar} />
          <ScoreCircle label="Prosódia" score={scores.prosody ?? scores.vocabulary} />
          <ScoreCircle label="PronScore" score={scores.pronScore ?? overall} />
        </div>

        {/* AI Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <div className="rounded-lg bg-secondary p-4 space-y-2 animate-fade-up" style={{ "--delay": "300ms" } as React.CSSProperties}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sugestões de Melhoria (IA)
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
