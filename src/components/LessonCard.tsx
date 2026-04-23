import { Clock, BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LessonCardProps {
  title: string;
  description: string;
  duration: string;
  category: string;
  isActive?: boolean;
  onClick?: () => void;
}

export default function LessonCard({
  title,
  description,
  duration,
  category,
  isActive,
  onClick,
}: LessonCardProps) {
  return (
    <Card
      className={`relative cursor-pointer hover-lift card-shine group press-effect overflow-hidden ${
        isActive
          ? "ring-2 ring-accent shadow-glow border-accent/40"
          : "hover:border-accent/30"
      }`}
      onClick={onClick}
    >
      {/* decorative gradient corner */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-accent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20" />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/15 border-accent/20"
              >
                {category}
              </Badge>
            </div>
            <h3 className="font-display font-bold text-foreground leading-snug group-hover:text-accent transition-colors duration-300">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {description}
            </p>
            <div className="flex items-center gap-4 pt-1.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Clock className="h-3.5 w-3.5" /> {duration}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <BookOpen className="h-3.5 w-3.5" /> Aula
              </span>
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary group-hover:bg-gradient-accent transition-all duration-300">
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground group-hover:translate-x-0.5 transition-all duration-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
