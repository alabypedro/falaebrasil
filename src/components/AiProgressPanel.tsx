import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Sparkles, Target, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { AiSource } from "@/lib/aiXp";

type Stat = {
  label: string;
  value: string | number;
  helper?: string;
};

type AiProgressPanelProps = {
  title: string;
  subtitle?: string;
  source?: AiSource;
  xpKeyPrefixes?: string[];
  completed?: number;
  total: number;
  pointsPerItem?: number;
  completedLabel?: string;
  totalLabel?: string;
  stats?: Stat[];
  icon?: ComponentType<{ className?: string }>;
};

export default function AiProgressPanel({
  title,
  subtitle,
  source,
  xpKeyPrefixes,
  completed,
  total,
  pointsPerItem = 25,
  completedLabel = "concluídos",
  totalLabel = "atividades",
  stats = [],
  icon: Icon = Activity,
}: AiProgressPanelProps) {
  const { user } = useAuth();
  const [earnedXp, setEarnedXp] = useState(0);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    if (!user || !source) {
      setEarnedXp(0);
      setEventCount(0);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_xp_events" as any)
        .select("points,key")
        .eq("user_id", user.id)
        .eq("source", source);

      if (cancelled) return;
      const rows = ((data as Array<{ points: number | null; key: string | null }>) || []).filter((row) => {
        if (!xpKeyPrefixes?.length) return true;
        return xpKeyPrefixes.some((prefix) => (row.key || "").startsWith(prefix));
      });
      setEarnedXp(rows.reduce((sum, row) => sum + (row.points || 0), 0));
      setEventCount(rows.length);
    })();

    return () => {
      cancelled = true;
    };
  }, [source, user?.id, xpKeyPrefixes]);

  const resolvedTotal = Math.max(0, total || 0);
  const resolvedCompleted = useMemo(() => {
    if (typeof completed === "number") return Math.max(0, completed);
    if (!pointsPerItem) return 0;
    return Math.min(resolvedTotal, Math.floor(earnedXp / pointsPerItem));
  }, [completed, earnedXp, pointsPerItem, resolvedTotal]);
  const progress = resolvedTotal > 0 ? Math.min(100, Math.round((resolvedCompleted / resolvedTotal) * 100)) : 0;
  const xpTarget = resolvedTotal * pointsPerItem;

  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">{title}</h2>
                <Badge variant="secondary" className="tabular-nums">{progress}%</Badge>
              </div>
              {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-64">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" /> {completedLabel}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {Math.min(resolvedCompleted, resolvedTotal)}<span className="text-xs text-muted-foreground">/{resolvedTotal}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-xp" /> XP
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {earnedXp}<span className="text-xs text-muted-foreground">/{xpTarget}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="tabular-nums">{Math.min(resolvedCompleted, resolvedTotal)} de {resolvedTotal} {totalLabel}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {(stats.length > 0 || eventCount > 0) && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg bg-muted/25 px-3 py-2">
                <p className="text-sm font-bold tabular-nums text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{stat.label}</p>
                {stat.helper && <p className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5">{stat.helper}</p>}
              </div>
            ))}
            {eventCount > 0 && (
              <div className="rounded-lg bg-muted/25 px-3 py-2">
                <p className="text-sm font-bold tabular-nums text-foreground">{eventCount}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">sessões com XP</p>
              </div>
            )}
          </div>
        )}

        {progress === 100 && resolvedTotal > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            <Sparkles className="h-4 w-4" /> Todas as atividades deste bloco estão completas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}