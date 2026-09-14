import React from 'react';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <>{isAuthenticated ? children : fallback}</>;
}
export function AdminRoute({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <>{user?.role === 'ADMIN' ? children : fallback}</>;
}
