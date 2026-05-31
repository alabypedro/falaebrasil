import { PlayCircle, Smartphone, Mic, BookOpen, Trophy, Library } from "lucide-react";

export const TUTORIAL_TOPICS = [
  {
    slug: "instalar-app",
    title: "Como instalar o aplicativo",
    description: "Adicione o Falaê Brasil! à tela inicial do seu celular ou computador.",
    icon: Smartphone,
    gradient: "bg-gradient-hero",
  },
  {
    slug: "creditos-ia",
    title: "Como usar os créditos de IA",
    description: "Entenda como funcionam os minutos de prática Scripted e Unscripted.",
    icon: Mic,
    gradient: "bg-gradient-accent",
  },
  {
    slug: "navegando-cursos",
    title: "Navegando pelos cursos",
    description: "Aprenda a percorrer módulos, aulas e quizzes do Falaê Brasil!",
    icon: BookOpen,
    gradient: "bg-gradient-xp",
  },
  {
    slug: "xp-nivel",
    title: "Acompanhando seu XP e Nível",
    description: "Veja como ganhar XP, subir de nível e manter sua streak.",
    icon: Trophy,
    gradient: "bg-gradient-to-br from-success to-success/70",
  },
  {
    slug: "biblioteca-bst",
    title: "Biblioteca BST",
    description: "Como acessar ebooks, áudios e materiais complementares.",
    icon: Library,
    gradient: "bg-gradient-to-br from-primary to-primary/70",
  },
  {
    slug: "comunidade",
    title: "Comunidades FB",
    description: "Acesse os grupos de WhatsApp por nível e pratique com outros alunos do Falaê Brasil!",
    icon: PlayCircle,
    gradient: "bg-gradient-to-br from-accent to-accent/70",
  },
] as const;

export type TutorialTopicSlug = typeof TUTORIAL_TOPICS[number]["slug"];

export function parseYoutube(url: string | null | undefined): { id: string; embedUrl: string; thumb: string } | null {
  if (!url) return null;
  const trimmed = url.trim();
  const m = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  const id = m?.[1] ?? (/^[\w-]{8,15}$/.test(trimmed) ? trimmed : null);
  if (!id) return null;
  return {
    id,
    // Adicionamos parâmetros para reduzir botões de compartilhamento e logo do YouTube
    embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0`,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}
