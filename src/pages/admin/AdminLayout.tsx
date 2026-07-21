import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Sparkles, Users, PlayCircle, FileSignature, ShieldCheck, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

// Top-level admin nav. Each entry (except Painel) leads to a hub page that
// links to the actual managers. Sub-routes still work directly.
const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Painel", end: true, match: ["/admin"] },
  { to: "/admin/hub/courses", icon: BookOpen, label: "Cursos", match: ["/admin/hub/courses", "/admin/courses", "/admin/modules", "/admin/lessons", "/admin/quizzes"] },
  { to: "/admin/hub/ai", icon: Sparkles, label: "IAs", match: ["/admin/hub/ai", "/admin/memorizae", "/admin/leiae", "/admin/library", "/admin/listening", "/admin/prompts"] },
  { to: "/admin/communities", icon: Users, label: "Comunidades FB", match: ["/admin/communities"] },
  { to: "/admin/hub/tutorials", icon: PlayCircle, label: "Tutoriais", match: ["/admin/hub/tutorials", "/admin/tutorials", "/admin/install-videos"] },
  { to: "/admin/contracts", icon: FileSignature, label: "Contratos", match: ["/admin/contracts"] },
  { to: "/admin/hub/admins", icon: ShieldCheck, label: "Admins", match: ["/admin/hub/admins", "/admin/admins", "/admin/create-student", "/admin/welcome-email"] },
  { to: "/admin/hub/asaas", icon: CreditCard, label: "ASAAS", match: ["/admin/hub/asaas", "/admin/payments", "/admin/webhook-logs", "/admin/link-payment"] },
];

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie cursos, módulos, lições, quizzes e biblioteca.</p>
      </div>

      <AdminNav />

      <Outlet />
    </div>
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
