import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "ADMIN" | "COMITE" | "AUTOR";

export const DASHBOARD_BY_ROLE: Record<Role, string> = {
  ADMIN: "/admin",
  COMITE: "/comite",
  AUTOR: "/autor",
};

interface Session {
  accessToken: string;
  refreshToken: string;
  roles: Role[];
  activeRole: Role | null;
  fullName: string;
}

interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean; // solo es true cuando ya hay rol activo
  startSession: (s: Session) => void;
  selectActiveRole: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null); // en memoria

  const startSession = useCallback((s: Session) => setSession(s), []);
  const selectActiveRole = useCallback((role: Role) => {
    setSession((prev) =>
      prev && prev.roles.includes(role) ? { ...prev, activeRole: role } : prev
    );
  }, []);
  const logout = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({ session, isAuthenticated: !!session?.activeRole, startSession, selectActiveRole, logout }),
    [session, startSession, selectActiveRole, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}