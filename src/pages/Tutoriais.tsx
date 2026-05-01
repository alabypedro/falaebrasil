import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, Smartphone, Mic, BookOpen, Trophy, Library } from "lucide-react";

const tutorials = [
  {
    title: "Como instalar o aplicativo",
    description: "Adicione o Falaê Brasil! à tela inicial do seu celular ou computador.",
    icon: Smartphone,
    gradient: "bg-gradient-hero",
  },
  {
    title: "Como usar os créditos de IA",
    description: "Entenda como funcionam os minutos de prática Scripted e Unscripted.",
    icon: Mic,
    gradient: "bg-gradient-accent",
  },
  {
    title: "Navegando pelos cursos",
    description: "Aprenda a percorrer módulos, aulas e quizzes do Falaê Brasil!",
    icon: BookOpen,
    gradient: "bg-gradient-xp",
  },
  {
    title: "Acompanhando seu XP e Nível",
    description: "Veja como ganhar XP, subir de nível e manter sua streak.",
    icon: Trophy,
    gradient: "bg-gradient-to-br from-success to-success/70",
  },
  {
    title: "Biblioteca BST",
    description: "Como acessar ebooks, áudios e materiais complementares.",
    icon: Library,
    gradient: "bg-gradient-to-br from-primary to-primary/70",
  },
  {
    title: "Comunidade Lets Falaê",
    description: "Participe dos canais por nível e pratique com outros alunos.",
    icon: PlayCircle,
    gradient: "bg-gradient-to-br from-accent to-accent/70",
  },
];

export default function Tutoriais() {
  return (
    <div className="space-y-8 max-w-6xl page-transition">
      <div className="animate-fade-up">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground tracking-tight">
          Tutoriais
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Aprenda a aproveitar ao máximo o Falaê Brasil! com nossos vídeos guiados.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((t, i) => (
          <Card
            key={t.title}
            className="animate-fade-up hover-lift card-shine cursor-pointer border-border/50 overflow-hidden group"
            style={{ "--delay": `${80 * (i + 1)}ms` } as React.CSSProperties}
          >
            <div className={`relative aspect-video ${t.gradient} flex items-center justify-center`}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              <div className="relative flex flex-col items-center gap-2 text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <PlayCircle className="h-7 w-7" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                  Vídeo em breve
                </span>
              </div>
            </div>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <t.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-display font-bold text-foreground leading-tight">
                    {t.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}