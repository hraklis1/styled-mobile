import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { identify, reset, track } from '../lib/analytics';
import type { User } from '../types/user';

export const LAST_LOGIN_EMAIL_KEY = 'lastLoginEmail';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  loginWithAppleToken: (identityToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapSupabaseUser(su: SupabaseUser): User {
  const provider = su.app_metadata?.provider ?? 'email';
  return {
    id: su.id,
    email: su.email ?? '',
    displayName: su.user_metadata?.full_name ?? su.email?.split('@')[0] ?? '',
    photoUrl: su.user_metadata?.avatar_url ?? null,
    isPremium: su.user_metadata?.is_premium ?? false,
    onboardingComplete: su.user_metadata?.onboarding_complete ?? false,
    authProvider: provider === 'google' ? 'google' : provider === 'apple' ? 'apple' : 'local',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore existing session on cold start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? mapSupabaseUser(session.user) : null);
      setIsLoading(false);
    });

    // Keep in sync for all subsequent auth events (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // PASSWORD_RECOVERY establishes a temporary session for updateUser — don't
      // treat it as a normal sign-in or the app screen will mount mid-reset-flow.
      if (event === 'PASSWORD_RECOVERY') {
        setIsLoading(false);
        return;
      }

      const mapped = session ? mapSupabaseUser(session.user) : null;
      setUser(mapped);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && mapped) {
        identify(mapped.id, { email: mapped.email, authProvider: mapped.authProvider });
        track('user_logged_in', { provider: mapped.authProvider });
      } else if (event === 'SIGNED_OUT') {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  // Expects the OpenID Connect id_token (JWT) from Google, not the OAuth access_token
  const loginWithGoogleToken = useCallback(async (idToken: string) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
  }, []);

  const loginWithAppleToken = useCallback(async (identityToken: string) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    SecureStore.deleteItemAsync(LAST_LOGIN_EMAIL_KEY).catch(() => {});
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
