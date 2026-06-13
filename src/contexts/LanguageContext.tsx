import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "pt" | "en";

type Dict = Record<string, { pt: string; en: string }>;

const dict: Dict = {
  // Header
  "header.theme.light": { pt: "Modo claro", en: "Light mode" },
  "header.theme.dark": { pt: "Modo escuro", en: "Dark mode" },
  "header.language": { pt: "Trocar idioma", en: "Switch language" },
  "header.signout": { pt: "Sair", en: "Sign out" },
  "header.upgrade": { pt: "Upgrade de plano", en: "Upgrade plan" },

  // Sidebar nav
  "nav.dashboard": { pt: "Painel", en: "Dashboard" },
  "nav.courses": { pt: "Cursos Falaê Brasil! (FB)", en: "Falaê Brasil! Courses (FB)" },
  "nav.voice": { pt: "IA Falaê", en: "AI Falaê" },
  "nav.listening": { pt: "IA Escutaê", en: "AI Escutaê" },
  "nav.writing": { pt: "IA Escreveaê", en: "AI Escreveaê" },
  "nav.library": { pt: "Biblioteca BST", en: "BST Library" },
  "nav.communities": { pt: "Comunidades FB", en: "FB Communities" },
  "nav.tutorials": { pt: "Tutoriais", en: "Tutorials" },
  "nav.contracts": { pt: "Contratos", en: "Contracts" },
  "nav.install": { pt: "Instalar App", en: "Install App" },
  "nav.admin": { pt: "Admin", en: "Admin" },
  "sidebar.subtitle": { pt: "Inglês Transversal", en: "Transversal English" },

  // Dashboard
  "dashboard.title": { pt: "Painel", en: "Dashboard" },
  "dashboard.welcome": {
    pt: "Bem-vindo de volta! Continue sua jornada de aprendizado.",
    en: "Welcome back! Continue your learning journey.",
  },
  "dashboard.xp": { pt: "XP Total", en: "Total XP" },
  "dashboard.level": { pt: "Nível de Fluência", en: "Fluency Level" },
  "dashboard.gpa": { pt: "Sua Nota Média", en: "Your Average Grade" },
  "dashboard.completed": { pt: "Aulas Concluídas", en: "Completed Lessons" },
  "dashboard.progress": { pt: "Progresso por Curso", en: "Progress by Course" },
  "dashboard.cta.badge": { pt: "Pratique agora", en: "Practice now" },
  "dashboard.cta.title": { pt: "Pratique sua pronúncia agora!", en: "Practice your pronunciation now!" },
  "dashboard.cta.desc": {
    pt: "Acesse o IA Falaê e melhore sua fluência com feedback em tempo real.",
    en: "Open AI Falaê and improve your fluency with real-time feedback.",
  },
  "dashboard.cta.btn": { pt: "Ir ao IA Falaê", en: "Go to AI Falaê" },
};

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language") as Language | null;
      if (stored === "pt" || stored === "en") return stored;
    }
    return "pt";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((p) => (p === "pt" ? "en" : "pt"));

  const t = (key: string, fallback?: string) => {
    const entry = dict[key];
    if (!entry) return fallback ?? key;
    return entry[language];
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}