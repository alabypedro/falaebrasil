import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  BookOpen, Layers, FileText, HelpCircle,
  Brain, BookText, Mic, MessageSquare, Headphones,
  PlayCircle, Smartphone,
  ShieldCheck,
  CreditCard, Webhook, Link2, RefreshCw,
} from "lucide-react";

type Item = {
  to: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient?: string;
};

function HubGrid({ title, subtitle, items }: { title: string; subtitle?: string; items: Item[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to}>
              <Card className="p-5 h-full hover:border-primary/60 hover:shadow-md transition-all group cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${it.gradient ?? "bg-primary/10 text-primary"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">{it.label}</div>
                    {it.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CoursesHub() {
  return (
    <HubGrid
      title="Cursos"
      subtitle="Gerencie cursos, módulos, lições e quizzes."
      items={[
        { to: "/admin/courses", label: "Cursos", description: "Lista de cursos", icon: BookOpen },
        { to: "/admin/modules", label: "Módulos", description: "Módulos dos cursos", icon: Layers },
        { to: "/admin/lessons", label: "Lições", description: "Lições dos módulos", icon: FileText },
        { to: "/admin/quizzes", label: "Quizzes", description: "Avaliações e quizzes", icon: HelpCircle },
      ]}
    />
  );
}

export function AIHub() {
  return (
    <HubGrid
      title="IAs"
      subtitle="Gerencie o conteúdo de cada IA da plataforma."
      items={[
        { to: "/admin/memorizae", label: "IA Memorizaê", description: "Flashcards e decks", icon: Brain, gradient: "bg-gradient-to-br from-purple-500 to-indigo-600 text-white" },
        { to: "/admin/prompts", label: "IA Falaê", description: "Textos de conversação", icon: Mic, gradient: "bg-gradient-to-br from-pink-500 to-rose-600 text-white" },
        { to: "/admin/listening", label: "IA Escutaê", description: "Áudios e transcrições", icon: Headphones, gradient: "bg-gradient-to-br from-blue-500 to-cyan-600 text-white" },
        { to: "/admin/leiae", label: "IA Leiaê", description: "Textos de leitura", icon: BookText, gradient: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" },
      ]}
    />
  );
}

export function TutorialsHub() {
  return (
    <HubGrid
      title="Tutoriais"
      subtitle="Vídeos de instalação e tutoriais gerais da plataforma."
      items={[
        { to: "/admin/install-videos", label: "Vídeos de Instalação", description: "PWA / instalação por SO", icon: Smartphone },
        { to: "/admin/tutorials", label: "Tutoriais da Plataforma", description: "Vídeos por tópico", icon: PlayCircle },
      ]}
    />
  );
}

export function AdminsHub() {
  return (
    <HubGrid
      title="Admins"
      subtitle="Gerenciar administradores da plataforma."
      items={[
        { to: "/admin/admins", label: "Admins", description: "Gerenciar administradores", icon: ShieldCheck },
      ]}
    />
  );
}

export function AsaasHub() {
  return (
    <HubGrid
      title="ASAAS"
      subtitle="Gateway de pagamento — produtos, logs e vinculação manual."
      items={[
        { to: "/admin/payments", label: "Pagamentos ASAAS", description: "Produtos, combos e cupons", icon: CreditCard },
        { to: "/admin/subscriptions", label: "Assinaturas PRO", description: "Mensalidades, recebíveis e ex-assinantes", icon: RefreshCw },
        { to: "/admin/webhook-logs", label: "Logs Webhook", description: "Eventos recebidos da ASAAS", icon: Webhook },
        { to: "/admin/link-payment", label: "Vincular Pagamento", description: "Vincular manualmente por ID", icon: Link2 },
      ]}
    />
  );
}