import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Library,
  Shield,
  HelpCircle,
  Download,
  Users,
  FileText,
  MessageSquareText,
  Headphones,
  Brain,
  BookText,
  Lock,
  GraduationCap,
  Music,
  BookMarked,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useRoles } from "@/hooks/useRoles";
import { useBstOnly } from "@/hooks/useBstOnly";
import { useLanguage } from "@/contexts/LanguageContext";
import falaeLogo from "@/assets/falae-brasil-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLocation } from "react-router-dom";

const navItems = [
  { key: "nav.dashboard", url: "/", icon: LayoutDashboard },
  { key: "nav.courses", url: "/courses", icon: BookOpen },
  { key: "nav.memorizae", url: "/memorizae", icon: Brain },
  { key: "nav.voice", url: "/voice-lab", icon: Mic },
  { key: "nav.listening", url: "/listening-lab", icon: Headphones },
  { key: "nav.writing", url: "/writing-lab", icon: MessageSquareText },
  { key: "nav.leiae", url: "/leiae", icon: BookText },
  { key: "nav.musiclab", url: "/music-lab", icon: Music },
  { key: "nav.communities", url: "/communities", icon: Users },
  { key: "nav.tutorials", url: "/tutoriais", icon: HelpCircle },
  { key: "nav.contracts", url: "/contratos", icon: FileText },
  { key: "nav.install", url: "/install", icon: Download },
];

const libraryItems = [
  { key: "nav.library.bst", url: "/library", icon: Library },
  { key: "nav.library.books", url: "/books", icon: BookMarked },
];

/** Rotas liberadas para alunos BST (as outras aparecem bloqueadas). */
const bstAllowedUrls = ["/library", "/tutoriais", "/install"];

export default function AppSidebar() {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { isTeacher } = useRoles();
  const { t } = useLanguage();
  const { isBstOnly } = useBstOnly();
  const { pathname } = useLocation();

  const items = navItems.map((item) => ({
    ...item,
    locked: isBstOnly && !bstAllowedUrls.includes(item.url),
  }));

  const libItems = libraryItems.map((item) => ({
    ...item,
    locked: isBstOnly && !bstAllowedUrls.includes(item.url),
  }));

  const isLibraryActive = pathname.startsWith("/library") || pathname.startsWith("/books");

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <SidebarContent className="bg-sidebar relative overflow-y-auto">
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
                {t("sidebar.subtitle")}
              </span>
            </div>
          )}
        </div>

        <SidebarGroup className="relative">
          <SidebarGroupContent>
            <SidebarMenu className={`gap-1 py-2 ${collapsed ? "px-1" : "px-2"}`}>
              {items.map((item, i) => (
                <SidebarMenuItem
                  key={item.key}
                  className="animate-slide-in-left"
                  style={{ "--delay": `${i * 50}ms` } as React.CSSProperties}
                >
                  {item.locked ? (
                    <SidebarMenuButton
                      className="h-10 rounded-lg opacity-50 cursor-not-allowed hover:bg-transparent"
                      tooltip={collapsed ? t(item.key) : undefined}
                      aria-disabled
                      onClick={(e) => e.preventDefault()}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && (
                        <>
                          <span className="text-sm truncate">{t(item.key)}</span>
                          <Lock className="h-3.5 w-3.5 shrink-0 ml-auto" />
                        </>
                      )}
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild className="h-10 rounded-lg" tooltip={collapsed ? t(item.key) : undefined}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        onClick={handleNavClick}
                        className={`hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-colors duration-200 ${collapsed ? "justify-center" : ""}`}
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                        {!collapsed && <span className="text-sm truncate">{t(item.key)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}

              {/* Biblioteca group */}
              <SidebarGroupLabel className={`mt-2 mb-1 ${collapsed ? "sr-only" : ""}`}>
                {t("nav.library")}
              </SidebarGroupLabel>
              {libItems.map((item, i) => (
                <SidebarMenuItem
                  key={item.key}
                  className="animate-slide-in-left"
                  style={{ "--delay": `${(items.length + i) * 50}ms` } as React.CSSProperties}
                >
                  {item.locked ? (
                    <SidebarMenuButton
                      className="h-10 rounded-lg opacity-50 cursor-not-allowed hover:bg-transparent"
                      tooltip={collapsed ? t(item.key) : undefined}
                      aria-disabled
                      onClick={(e) => e.preventDefault()}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && (
                        <>
                          <span className="text-sm truncate">{t(item.key)}</span>
                          <Lock className="h-3.5 w-3.5 shrink-0 ml-auto" />
                        </>
                      )}
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild className="h-10 rounded-lg" tooltip={collapsed ? t(item.key) : undefined}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        onClick={handleNavClick}
                        className={`hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-colors duration-200 ${collapsed ? "justify-center" : ""}`}
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                        {!collapsed && <span className="text-sm truncate">{t(item.key)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}

              {isTeacher && (
                <SidebarMenuItem
                  className="animate-slide-in-left mt-2 pt-2 border-t border-sidebar-border/30"
                  style={{ "--delay": `${(items.length + libItems.length) * 50}ms` } as React.CSSProperties}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg" tooltip={collapsed ? "Meus Alunos" : undefined}>
                    <NavLink
                      to="/professor/alunos"
                      onClick={handleNavClick}
                      className={`hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-colors duration-200 ${collapsed ? "justify-center" : ""}`}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <GraduationCap className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && <span className="text-sm truncate">Meus Alunos</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {isAdmin && (
                <SidebarMenuItem
                  className="animate-slide-in-left mt-2 pt-2 border-t border-sidebar-border/30"
                  style={{ "--delay": `${items.length * 50}ms` } as React.CSSProperties}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg" tooltip={collapsed ? t("nav.admin") : undefined}>
                    <NavLink
                      to="/admin"
                      onClick={handleNavClick}
                      className={`hover:bg-sidebar-accent/60 hover:text-sidebar-primary transition-colors duration-200 ${collapsed ? "justify-center" : ""}`}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <Shield className={`h-4 w-4 shrink-0 ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && <span className="text-sm truncate">{t("nav.admin")}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border/30">
      </SidebarFooter>
    </Sidebar>
  );
}
