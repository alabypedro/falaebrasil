import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Library,
  Zap,
  Shield,
  HelpCircle,
  Download,
  Users,
  FileText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Progress } from "@/components/ui/progress";
import falaeLogo from "@/assets/falae-brasil-logo.png";
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
  { title: "Cursos Falaê Brasil! (FB)", url: "/courses", icon: BookOpen },
  { title: "IA Falaê", url: "/voice-lab", icon: Mic },
  { title: "Biblioteca BST", url: "/library", icon: Library },
  { title: "Comunidades FB", url: "/communities", icon: Users },
  { title: "Tutoriais", url: "/tutoriais", icon: HelpCircle },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Instalar App", url: "/install", icon: Download },
];

export default function AppSidebar() {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <SidebarContent className="bg-sidebar relative overflow-hidden">
        {/* Decorative gradient blobs (clipped by overflow-hidden) */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute bottom-20 -right-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

        {/* Logo */}
        <div className={`relative flex items-center border-b border-sidebar-border/30 ${collapsed ? "justify-center px-2 py-4" : "gap-2.5 px-4 py-5"}`}>
          <img
            src={falaeLogo}
            alt="Falaê Brasil!"
            className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
          />
          {!collapsed && (
            <div className="flex flex-col animate-fade-in min-w-0">
              <span className="text-sm font-display font-bold text-sidebar-foreground leading-tight tracking-tight truncate">
                Falaê Brasil!
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 leading-tight font-medium truncate">
                Inglês Transversal
              </span>
            </div>
          )}
        </div>

        <SidebarGroup className="relative">
          <SidebarGroupContent>
            <SidebarMenu className={`gap-1 py-2 ${collapsed ? "px-1" : "px-2"}`}>
              {navItems.map((item, i) => (
                <SidebarMenuItem
                  key={item.title}
                  className="animate-slide-in-left"
                  style={{ "--delay": `${i * 50}ms` } as React.CSSProperties}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg" tooltip={collapsed ? item.title : undefined}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      onClick={handleNavClick}
                      className={`hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-colors duration-200 ${collapsed ? "justify-center" : ""}`}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && <span className="text-sm truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {isAdmin && (
                <SidebarMenuItem
                  className="animate-slide-in-left mt-2 pt-2 border-t border-sidebar-border/30"
                  style={{ "--delay": `${navItems.length * 50}ms` } as React.CSSProperties}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg" tooltip={collapsed ? "Admin" : undefined}>
                    <NavLink
                      to="/admin"
                      onClick={handleNavClick}
                      className={`hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-colors duration-200 ${collapsed ? "justify-center" : ""}`}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <Shield className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && <span className="text-sm truncate">Admin</span>}
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
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-xp shadow-soft-sm">
                  <Zap className="h-3 w-3 text-xp-foreground fill-xp-foreground/30" />
                </div>
                <span className="text-xs font-bold text-sidebar-foreground tabular-nums truncate">
                  {profile?.xp ?? 0} XP
                </span>
              </div>
              <span className="text-[10px] font-semibold text-sidebar-foreground/70 px-2 py-0.5 rounded-full bg-sidebar-accent/50 shrink-0">
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
