import { Zap } from "lucide-react";

interface XPBadgeProps {
  xp: number;
  level: string;
  compact?: boolean;
}

export default function XPBadge({ xp, level, compact = false }: XPBadgeProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-xp/15 px-2.5 py-1">
        <Zap className="h-3.5 w-3.5 text-xp" />
        <span className="text-xs font-bold text-xp">{xp} XP</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-xp/15">
        <Zap className="h-5 w-5 text-xp" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{xp} XP</p>
        <p className="text-xs text-muted-foreground">Nível {level}</p>
      </div>
    </div>
  );
}
