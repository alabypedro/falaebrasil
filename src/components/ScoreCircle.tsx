interface ScoreCircleProps {
  label: string;
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "hsl(142, 71%, 45%)";   // green
  if (score >= 60) return "hsl(48, 96%, 53%)";     // yellow
  if (score >= 40) return "hsl(36, 100%, 50%)";    // orange
  return "hsl(0, 84%, 60%)";                        // red
}

export default function ScoreCircle({ label, score, size = 90 }: ScoreCircleProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1.5 animate-scale-in">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="animate-draw-circle"
          style={{
            "--circumference": circumference,
            "--offset": offset,
          } as React.CSSProperties}
        />
      </svg>
      <span className="text-lg font-bold" style={{ color }}>{Math.round(score)}</span>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}
