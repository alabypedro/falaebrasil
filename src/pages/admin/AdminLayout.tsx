import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Layers, FileText, HelpCircle, LayoutDashboard, Library, Mic, ShieldCheck, ShoppingCart, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Painel", end: true },
  { to: "/admin/courses", icon: BookOpen, label: "Cursos" },
  { to: "/admin/modules", icon: Layers, label: "Módulos" },
  { to: "/admin/lessons", icon: FileText, label: "Lições" },
  { to: "/admin/quizzes", icon: HelpCircle, label: "Quizzes" },
  { to: "/admin/library", icon: Library, label: "Biblioteca BST" },
  { to: "/admin/prompts", icon: Mic, label: "Textos IA Falaê" },
  { to: "/admin/tutorials", icon: PlayCircle, label: "Tutoriais" },
  { to: "/admin/admins", icon: ShieldCheck, label: "Admins" },
  { to: "/admin/hubla", icon: ShoppingCart, label: "Vendas Hubla" },
];

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie cursos, módulos, lições, quizzes e biblioteca.</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b pb-px">
        {adminNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
