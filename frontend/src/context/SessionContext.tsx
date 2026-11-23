import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ACCESS_TOKEN_KEY,
  ACTIVE_ROLE_KEY,
  clearStoredAuth,
  FULL_NAME_KEY,
  REFRESH_TOKEN_KEY,
  USER_ROLES_KEY,
} from '../services/authStorage';

export type Role = 'ADMIN' | 'COMITE' | 'AUTOR';

interface Session {
  accessToken: string;
  refreshToken: string;
  roles: Role[];
  activeRole: Role | null;
  fullName: string;
}

const isRole = (value: unknown): value is Role =>
  value === 'ADMIN' || value === 'COMITE' || value === 'AUTOR';

const persistSession = (session: Session) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(USER_ROLES_KEY, JSON.stringify(session.roles));
  localStorage.setItem(FULL_NAME_KEY, session.fullName);
  if (session.activeRole) {
    localStorage.setItem(ACTIVE_ROLE_KEY, session.activeRole);
  } else {
    localStorage.removeItem(ACTIVE_ROLE_KEY);
  }
};

const readStoredSession = (): Session | null => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const fullName = localStorage.getItem(FULL_NAME_KEY);
  const storedRoles = localStorage.getItem(USER_ROLES_KEY);

  if (!accessToken || !refreshToken || !fullName || !storedRoles) {
    clearStoredAuth();
    return null;
  }

  let roles: unknown;
  try {
    roles = JSON.parse(storedRoles);
  } catch {
    clearStoredAuth();
    return null;
  }

  if (!Array.isArray(roles) || roles.length === 0 || !roles.every(isRole)) {
    clearStoredAuth();
    return null;
  }

  const selectedRole = localStorage.getItem(ACTIVE_ROLE_KEY);
  const activeRole =
    isRole(selectedRole) && roles.includes(selectedRole)
      ? selectedRole
      : roles.length === 1
        ? roles[0]
        : null;

  const session: Session = {
    accessToken,
    refreshToken,
    roles,
    activeRole,
    fullName,
  };
  persistSession(session);
  return session;
};

interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean; // solo es true cuando ya hay rol activo
  startSession: (s: Session) => void;
  selectActiveRole: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession);

  useEffect(() => {
    const handleAuthExpired = () => setSession(null);
    window.addEventListener('symposia:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('symposia:auth-expired', handleAuthExpired);
  }, []);

  const startSession = useCallback((nextSession: Session) => {
    persistSession(nextSession);
    setSession(nextSession);
  }, []);
  const selectActiveRole = useCallback((role: Role) => {
    if (!session || !session.roles.includes(role)) return;
    const nextSession = { ...session, activeRole: role };
    persistSession(nextSession);
    setSession(nextSession);
  }, [session]);
  const logout = useCallback(() => {
    clearStoredAuth();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session?.activeRole),
      startSession,
      selectActiveRole,
      logout,
    }),
    [session, startSession, selectActiveRole, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}