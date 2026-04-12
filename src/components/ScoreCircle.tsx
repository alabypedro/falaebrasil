interface ScoreCircleProps {
  label: string;
  score: number;
  color?: string;
  size?: number;
}

export default function ScoreCircle({ label, score, color = "hsl(var(--accent))", size = 90 }: ScoreCircleProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

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
      <span className="text-lg font-bold text-foreground">{score}</span>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}
