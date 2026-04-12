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
      className={`cursor-pointer hover-lift group press-effect ${
        isActive ? "ring-2 ring-primary shadow-md" : "hover:border-primary/30"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-medium">
                {category}
              </Badge>
            </div>
            <h3 className="font-semibold text-foreground leading-snug">{title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            <div className="flex items-center gap-4 pt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {duration}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" /> Aula
              </span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200 mt-1 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
