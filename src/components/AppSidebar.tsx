import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Library,
  Users,
  Zap,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  { title: "Laboratório de Voz", url: "/voice-lab", icon: Mic },
  { title: "Biblioteca BST", url: "/library", icon: Library },
  { title: "Comunidade", url: "/community", icon: Users },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            FB
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground leading-tight">
                Falaê Brasil!
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 leading-tight">
                Inglês Transversal
              </span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="space-y-2 px-2 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-xp" />
                <span className="text-xs font-bold text-sidebar-foreground">
                  {profile?.xp ?? 0} XP
                </span>
              </div>
              <span className="text-[10px] text-sidebar-foreground/60">
                Nível {profile?.level ?? "A1"}
              </span>
            </div>
            <Progress value={((profile?.xp ?? 0) % 500) / 5} className="h-1.5 bg-sidebar-accent" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
