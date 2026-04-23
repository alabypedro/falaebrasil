import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Library,
  Users,
  Zap,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Meus Cursos", url: "/courses", icon: BookOpen },
  { title: "AI Falaê", url: "/voice-lab", icon: Mic },
  { title: "Biblioteca BST", url: "/library", icon: Library },
  { title: "Comunidade", url: "/community", icon: Users },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <SidebarContent className="bg-sidebar relative overflow-hidden">
        {/* Decorative gradient blob */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute bottom-20 -right-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-accent text-sidebar-primary-foreground font-display font-extrabold text-sm shadow-glow">
            FB
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-fade-in">
              <span className="text-sm font-display font-bold text-sidebar-foreground leading-tight tracking-tight">
                Falaê Brasil!
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 leading-tight font-medium">
                Inglês Transversal
              </span>
            </div>
          )}
        </div>

        <SidebarGroup className="relative">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2 py-2">
              {navItems.map((item, i) => (
                <SidebarMenuItem
                  key={item.title}
                  className="animate-slide-in-left"
                  style={{ "--delay": `${i * 50}ms` } as React.CSSProperties}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-all duration-200"
                      activeClassName="bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-primary font-semibold border-l-2 border-sidebar-primary"
                    >
                      <item.icon className="mr-2.5 h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {isAdmin && (
                <SidebarMenuItem
                  className="animate-slide-in-left mt-2 pt-2 border-t border-sidebar-border/30"
                  style={{ "--delay": `${navItems.length * 50}ms` } as React.CSSProperties}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg">
                    <NavLink
                      to="/admin"
                      className="hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-all duration-200"
                      activeClassName="bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-primary font-semibold border-l-2 border-sidebar-primary"
                    >
                      <Shield className="mr-2.5 h-4 w-4" />
                      {!collapsed && <span className="text-sm">Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border/30">
        {!collapsed && (
          <div className="space-y-2.5 px-3 py-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-xp shadow-soft-sm">
                  <Zap className="h-3 w-3 text-xp-foreground fill-xp-foreground/30" />
                </div>
                <span className="text-xs font-bold text-sidebar-foreground tabular-nums">
                  {profile?.xp ?? 0} XP
                </span>
              </div>
              <span className="text-[10px] font-semibold text-sidebar-foreground/70 px-2 py-0.5 rounded-full bg-sidebar-accent/50">
                {profile?.level ?? "A1"}
              </span>
            </div>
            <Progress
              value={((profile?.xp ?? 0) % 500) / 5}
              className="h-1.5 bg-sidebar-accent/60 [&>div]:bg-gradient-accent"
            />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
