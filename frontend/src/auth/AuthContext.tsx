import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  const refreshSession = useCallback(async () => {
    try { const current = await apiClient.auth.me(); setUser(current); return current; }
    catch (error) { if (error instanceof ApiError && error.status !== 401) console.warn('No se pudo restaurar la sesión.', error); setUser(null); return null; }
  }, []);
  useEffect(() => { void refreshSession().finally(() => setLoading(false)); }, [refreshSession]);
  const login = useCallback(async (input: Credentials) => { const result = await apiClient.auth.login(input.email, input.password); setUser(result.user); return result.user; }, []);
  const register = useCallback(async (input: RegisterInput) => { const result = await apiClient.auth.register(input.email, input.password, input.displayName); setUser(result.user); return result.user; }, []);
  const logout = useCallback(async () => { try { await apiClient.auth.logout(); } finally { setUser(null); } }, []);
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isLoading, login, register, logout, refreshSession }), [user, isLoading, login, register, logout, refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.'); return value; }
