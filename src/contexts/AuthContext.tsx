import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    level: string;
    xp: number;
    streak_days: number;
    has_course_access: boolean;
    has_ebook1_access: boolean;
    has_ebook2_access: boolean;
    has_ebook3_access: boolean;
    plan_tier: "open" | "pro" | "vip" | "kids" | "teens";
    scripted_balance: number;
    unscripted_balance: number;
    best_scripted_score: number;
    best_unscripted_score: number;
    subscription_status: string;
    subscription_grace_until: string | null;
    subscription_current_period_end: string | null;
  } | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  profile: null,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, level, xp, streak_days, has_course_access, has_ebook1_access, has_ebook2_access, has_ebook3_access, plan_tier, scripted_balance, unscripted_balance, best_scripted_score, best_unscripted_score, subscription_status, subscription_grace_until, subscription_current_period_end")
      .eq("user_id", user.id)
      .single();
    if (data) setProfile(data as any);
  };

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, profile, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
