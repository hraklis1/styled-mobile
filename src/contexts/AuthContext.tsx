import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { User } from '../types/user';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogleToken: (accessToken: string) => Promise<void>;
  loginWithAppleToken: (identityToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<User>('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const res = await api.post<User>('/api/auth/login', { email, password });
    setUser(res.data);
  }, []);

  const loginWithGoogleToken = useCallback(async (accessToken: string) => {
    const res = await api.post<User>('/api/auth/google/mobile', { accessToken });
    setUser(res.data);
  }, []);

  const loginWithAppleToken = useCallback(async (identityToken: string) => {
    const res = await api.post<User>('/api/auth/apple/mobile', { identityToken });
    setUser(res.data);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, loginWithEmail, loginWithGoogleToken, loginWithAppleToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
