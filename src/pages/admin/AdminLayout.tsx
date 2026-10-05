import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, BookOpen, Sparkles, Users, PlayCircle, FileSignature, ShieldCheck, CreditCard, Music, ArrowLeft, Library, GraduationCap, Presentation, BookMarked, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Top-level admin nav. Each entry (except Painel) leads to a hub page that
// links to the actual managers. Sub-routes still work directly.
const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Painel", end: true, match: ["/admin"] },
  { to: "/admin/students", icon: GraduationCap, label: "Alunos", match: ["/admin/students"] },
  { to: "/admin/relationship", icon: HeartHandshake, label: "Relacionamento", match: ["/admin/relationship"] },
  { to: "/admin/teachers", icon: Presentation, label: "Professores", match: ["/admin/teachers"] },
  { to: "/admin/hub/courses", icon: BookOpen, label: "Cursos", match: ["/admin/hub/courses", "/admin/courses", "/admin/modules", "/admin/lessons", "/admin/quizzes"] },
  { to: "/admin/hub/ai", icon: Sparkles, label: "IAs", match: ["/admin/hub/ai", "/admin/memorizae", "/admin/leiae", "/admin/listening", "/admin/prompts"] },
  { to: "/admin/music-lab", icon: Music, label: "Cantaê", match: ["/admin/music-lab"] },
  { to: "/admin/books", icon: BookMarked, label: "Livros", match: ["/admin/books"] },
  { to: "/admin/library", icon: Library, label: "Bibliotecaê BST", match: ["/admin/library"] },
  { to: "/admin/communities", icon: Users, label: "Comunidades FB", match: ["/admin/communities"] },
  { to: "/admin/hub/tutorials", icon: PlayCircle, label: "Tutoriais", match: ["/admin/hub/tutorials", "/admin/tutorials", "/admin/install-videos"] },
  { to: "/admin/contracts", icon: FileSignature, label: "Contratos", match: ["/admin/contracts"] },
  { to: "/admin/hub/admins", icon: ShieldCheck, label: "Admins", match: ["/admin/hub/admins", "/admin/admins", "/admin/create-student", "/admin/welcome-email"] },
  { to: "/admin/hub/asaas", icon: CreditCard, label: "ASAAS", match: ["/admin/hub/asaas", "/admin/payments", "/admin/webhook-logs", "/admin/link-payment"] },
];

// Map each sub-page path to the hub it belongs to.
const HUB_BY_SUBPATH: Record<string, { to: string; label: string }> = {
  "/admin/courses": { to: "/admin/hub/courses", label: "Cursos" },
  "/admin/modules": { to: "/admin/hub/courses", label: "Cursos" },
  "/admin/lessons": { to: "/admin/hub/courses", label: "Cursos" },
  "/admin/quizzes": { to: "/admin/hub/courses", label: "Cursos" },
  "/admin/memorizae": { to: "/admin/hub/ai", label: "IAs" },
  "/admin/leiae": { to: "/admin/hub/ai", label: "IAs" },
  "/admin/listening": { to: "/admin/hub/ai", label: "IAs" },
  "/admin/prompts": { to: "/admin/hub/ai", label: "IAs" },
  "/admin/tutorials": { to: "/admin/hub/tutorials", label: "Tutoriais" },
  "/admin/install-videos": { to: "/admin/hub/tutorials", label: "Tutoriais" },
  "/admin/admins": { to: "/admin/hub/admins", label: "Admins" },
  "/admin/create-student": { to: "/admin/hub/admins", label: "Admins" },
  "/admin/welcome-email": { to: "/admin/hub/admins", label: "Admins" },
  "/admin/payments": { to: "/admin/hub/asaas", label: "ASAAS" },
  "/admin/webhook-logs": { to: "/admin/hub/asaas", label: "ASAAS" },
  "/admin/link-payment": { to: "/admin/hub/asaas", label: "ASAAS" },
};

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie cursos, módulos, lições, quizzes e Bibliotecaê.</p>
      </div>

      <AdminNav />

      <BackToHub />

      <Outlet />
    </div>
  );
}

function BackToHub() {
  const { pathname } = useLocation();
  const hub = HUB_BY_SUBPATH[pathname];
  if (!hub) return null;
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground hover:text-foreground">
      <Link to={hub.to}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Voltar para {hub.label}
      </Link>
    </Button>
  );
}

function AdminNav() {
  const { pathname } = useLocation();
  const isActive = (item: (typeof adminNav)[number]) => {
    if (item.end) return pathname === item.to;
    return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  };
  return (
    <nav className="flex gap-1 overflow-x-auto border-b pb-px">
      {adminNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors whitespace-nowrap",
            isActive(item)
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
