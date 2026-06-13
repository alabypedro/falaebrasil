import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import XPBadge from "@/components/XPBadge";
import SubscriptionStatusBanner from "@/components/SubscriptionStatusBanner";
import UpgradeButton from "@/components/UpgradeButton";
import { useLanguage } from "@/contexts/LanguageContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { profile, signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
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
          <header className="sticky top-0 z-40 h-16 flex items-center justify-between border-b border-border/50 bg-background/70 backdrop-blur-xl backdrop-saturate-150 px-4 md:px-6 animate-fade-in">
            <SidebarTrigger className="ml-0 press-effect rounded-lg hover:bg-accent/10" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleTheme}
                title={theme === "light" ? t("header.theme.dark") : t("header.theme.light")}
                className="press-effect rounded-lg hover:bg-accent/10 hover:text-accent transition-all duration-300"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleLanguage}
                title={t("header.language")}
                aria-label={t("header.language")}
                className="press-effect rounded-lg hover:bg-accent/10 hover:text-accent transition-all duration-300 text-xs font-bold tabular-nums"
              >
                {language === "pt" ? "EN" : "PT"}
              </Button>
              <UpgradeButton />
              <XPBadge xp={profile?.xp ?? 0} level={profile?.level ?? "A1"} compact />
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent/10 transition-all duration-200 press-effect"
              >
                <Avatar className="h-8 w-8 ring-2 ring-border/50 hover:ring-accent/40 transition-all duration-300">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground hidden sm:inline">
                  {displayName}
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={signOut}
                title={t("header.signout")}
                className="press-effect rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <SubscriptionStatusBanner />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
