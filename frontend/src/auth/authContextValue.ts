import { createContext, useContext } from 'react';

export type CurrentUser = { id: string; email: string; displayName?: string | null; role: 'USER' | 'ADMIN'; status: string };
export type Credentials = { email: string; password: string };
export type RegisterInput = Credentials & { displayName: string };
export type AuthValue = {
  user: CurrentUser | null; isAuthenticated: boolean; isLoading: boolean;
  login(input: Credentials): Promise<CurrentUser>;
  register(input: RegisterInput): Promise<CurrentUser>;
  logout(): Promise<void>; refreshSession(): Promise<CurrentUser | null>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return value;
}
