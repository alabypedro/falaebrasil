import { Hourglass } from "lucide-react";
import { useExperienceStatus } from "@/hooks/useExperienceStatus";

/**
 * Aviso da Experiência PRO de 30 dias: mostra quanto tempo falta e para qual
 * público o acesso está liberado. Some sozinho quando o prazo termina.
 */
export default function ExperienceBanner() {
  const { active, segment, expires_at, days_left } = useExperienceStatus();

  if (!active || !expires_at) return null;

  const dateLabel = new Date(expires_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const audience = segment === "kids_teens" ? "Kids e Teens" : "Adultos";
  const days = typeof days_left === "number" ? days_left : null;

  return (
    <div className="w-full bg-primary/10 border-b border-primary/25 text-foreground">
      <div className="px-4 md:px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <Hourglass className="h-4 w-4 flex-shrink-0 text-primary" />
        <p className="text-sm flex-1 min-w-0">
          <strong>Experiência PRO {days !== null ? `· ${days} ${days === 1 ? "dia" : "dias"}` : ""}</strong>{" "}
          {days !== null ? "restantes" : ""} — acesso liberado para {audience} até {dateLabel}.
        </p>
      </div>
    </div>
  );
}
