import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "lojista" | "afiliado" | "entregador";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const REDIRECT_MAP: Record<string, string> = {
  admin: "/admin",
  lojista: "/lojista",
  afiliado: "/afiliado/painel",
  entregador: "/entregador",
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  rolesLoaded: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any; redirectTo?: string }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  getRedirectPath: (roles?: AppRole[]) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  const fetchRoles = async (userId: string): Promise<AppRole[]> => {
    setRolesLoaded(false);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = data?.map((r) => r.role) ?? [];
    setRoles(userRoles);
    setRolesLoaded(true);
    return userRoles;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setRolesLoaded(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
        ]).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
        setRolesLoaded(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getRedirectPath = (userRoles?: AppRole[]) => {
    const r = userRoles ?? roles;
    // Priority: admin > lojista > afiliado > entregador
    for (const role of ["admin", "lojista", "afiliado", "entregador"] as AppRole[]) {
      if (r.includes(role)) return REDIRECT_MAP[role];
    }
    return "/";
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Always force PDV user re-selection on a fresh login
    try { sessionStorage.removeItem("pdv_active_user"); } catch {}
    try { localStorage.removeItem("noov_master_session"); } catch {}
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // Fetch roles immediately to determine redirect
    if (data.user) {
      const userRoles = await fetchRoles(data.user.id);
      await fetchProfile(data.user.id);
      return { error: null, redirectTo: getRedirectPath(userRoles) };
    }
    return { error: null };
  };

  const signOut = async () => {
    try { sessionStorage.removeItem("pdv_active_user"); } catch {}
    try { localStorage.removeItem("noov_master_session"); } catch {}
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setRolesLoaded(false);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, isLoading, rolesLoaded, signUp, signIn, signOut, hasRole, getRedirectPath }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
