import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, ApiError } from '../services/apiClient';

export type CurrentUser = { id: string; email: string; displayName?: string | null; role: 'USER' | 'ADMIN'; status: string };
type Credentials = { email: string; password: string };
type RegisterInput = Credentials & { displayName: string };
type AuthValue = {
  user: CurrentUser | null; isAuthenticated: boolean; isLoading: boolean;
  login(input: Credentials): Promise<CurrentUser>;
  register(input: RegisterInput): Promise<CurrentUser>;
  logout(): Promise<void>; refreshSession(): Promise<CurrentUser | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  // Monotonic counter identifying the newest auth intent. The session restore
  // fired at mount can still be in flight when the user submits the login form;
  // without this guard its 401 would overwrite the session created by the login.
  const epoch = useRef(0);
  const refreshSession = useCallback(async () => {
    const startedAt = ++epoch.current;
    try {
      const current = await apiClient.auth.me();
      if (startedAt === epoch.current) setUser(current);
      return current;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) console.warn('No se pudo restaurar la sesión.', error);
      if (startedAt === epoch.current) setUser(null);
      return null;
    }
  }, []);
  useEffect(() => { void refreshSession().finally(() => setLoading(false)); }, [refreshSession]);
  // login/register already return the authenticated user: no extra /auth/me
  // call, which used to be deduplicated against the unauthenticated request
  // from the mount-time session restore.
  const login = useCallback(async (input: Credentials) => {
    epoch.current += 1;
    const current = await apiClient.auth.login(input.email, input.password);
    setUser(current);
    return current;
  }, []);
  const register = useCallback(async (input: RegisterInput) => {
    epoch.current += 1;
    const current = await apiClient.auth.register(input.email, input.password, input.displayName);
    setUser(current);
    return current;
  }, []);
  const logout = useCallback(async () => { epoch.current += 1; try { await apiClient.auth.logout(); } finally { setUser(null); } }, []);
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isLoading, login, register, logout, refreshSession }), [user, isLoading, login, register, logout, refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.'); return value; }
