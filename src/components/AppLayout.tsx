import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import XPBadge from "@/components/XPBadge";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { profile, signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const displayName = profile?.display_name || user?.email || "Aluno";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 animate-fade-in">
            <SidebarTrigger className="ml-0 press-effect" />
            <div className="flex items-center gap-3">
              <XPBadge xp={profile?.xp ?? 0} level={profile?.level ?? "A1"} compact />
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 hover:opacity-80 transition-all duration-200 press-effect"
              >
                <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-accent/30 transition-all duration-200">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {displayName}
                </span>
              </button>
              <Button size="icon" variant="ghost" onClick={signOut} title="Sair" className="press-effect hover:text-destructive transition-colors">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
