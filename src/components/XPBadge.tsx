import { Zap } from "lucide-react";

interface XPBadgeProps {
  xp: number;
  level: string;
  compact?: boolean;
}

export default function XPBadge({ xp, level, compact = false }: XPBadgeProps) {
  if (compact) {
    return (
      <div className="group flex items-center gap-1.5 rounded-full bg-gradient-xp px-3 py-1.5 shadow-soft-sm hover:shadow-glow hover-scale cursor-default transition-all duration-300">
        <Zap className="h-3.5 w-3.5 text-xp-foreground fill-xp-foreground/20" />
        <span className="text-xs font-bold text-xp-foreground tabular-nums">{xp} XP</span>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-soft-md hover:shadow-soft-lg hover-lift transition-all">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-xp shadow-soft-sm group-hover:shadow-glow transition-all duration-300">
        <Zap className="h-5 w-5 text-xp-foreground fill-xp-foreground/30" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground tabular-nums">{xp} XP</p>
        <p className="text-xs text-muted-foreground">Nível {level}</p>
      </div>
    </div>
  );
}
