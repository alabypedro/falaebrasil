import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, CheckCircle } from "lucide-react";

interface Course {
  id: string;
  title: string;
  level: string;
  modules: number;
  progress: number;
  locked: boolean;
}

const coursesData: Record<string, Course[]> = {
  adults: [
    { id: "a1", title: "Foundations", level: "A1", modules: 12, progress: 100, locked: false },
    { id: "a2", title: "Building Confidence", level: "A2", modules: 14, progress: 62, locked: false },
    { id: "b1", title: "Independent Speaker", level: "B1", modules: 16, progress: 0, locked: true },
    { id: "b2", title: "Advanced Communication", level: "B2", modules: 18, progress: 0, locked: true },
  ],
  teens: [
    { id: "t-a1", title: "Getting Started", level: "A1", modules: 10, progress: 45, locked: false },
    { id: "t-a2", title: "Express Yourself", level: "A2", modules: 12, progress: 0, locked: true },
    { id: "t-b1", title: "Debate & Discuss", level: "B1", modules: 14, progress: 0, locked: true },
  ],
  kids: [
    { id: "k-a1", title: "Fun with English", level: "A1", modules: 8, progress: 30, locked: false },
    { id: "k-a2", title: "Story Time", level: "A2", modules: 10, progress: 0, locked: true },
  ],
};

const levelColors: Record<string, string> = {
  A1: "bg-success/15 text-success",
  A2: "bg-accent/15 text-accent",
  B1: "bg-xp/15 text-xp",
  B2: "bg-innovation/15 text-innovation",
};

function CourseCard({ course }: { course: Course }) {
  return (
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-md ${course.locked ? "opacity-60" : ""}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <Badge className={`text-[10px] ${levelColors[course.level] || ""} border-0`}>
              {course.level}
            </Badge>
            <h3 className="text-sm font-semibold text-foreground mt-2">{course.title}</h3>
            <p className="text-xs text-muted-foreground">{course.modules} módulos</p>
          </div>
          {course.locked ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : course.progress === 100 ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : null}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{course.progress}%</span>
          </div>
          <Progress value={course.progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Courses() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trilhas de aprendizado do A1 ao B2 — escolha seu perfil.
        </p>
      </div>

      <Tabs defaultValue="adults">
        <TabsList>
          <TabsTrigger value="adults">Adults</TabsTrigger>
          <TabsTrigger value="teens">Teens</TabsTrigger>
          <TabsTrigger value="kids">Kids</TabsTrigger>
        </TabsList>

        {Object.entries(coursesData).map(([key, courses]) => (
          <TabsContent key={key} value={key}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
