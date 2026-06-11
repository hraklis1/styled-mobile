import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { identify, reset, track } from '../lib/analytics';
import { clearUserQueryCache } from '../lib/queryClient';
import { deleteDeviceValue, getDeviceValue, setDeviceValue } from '../lib/deviceStorage';
import {
  Purchases,
  ENTITLEMENT_ID,
  IS_PREMIUM_CACHE_KEY,
  loginUser,
  logoutUser,
  getIsPremium,
  purchasesReady,
} from '../lib/purchases';
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
    isPremium: false, // RevenueCat is the sole source of truth; set via hydrateRcPremium
    onboardingComplete: su.user_metadata?.onboarding_complete ?? false,
    authProvider: provider === 'google' ? 'google' : provider === 'apple' ? 'apple' : 'local',
  };
}

async function hydrateRcPremium(userId: string): Promise<boolean> {
  if (!purchasesReady()) return false;
  await loginUser(userId);
  return getIsPremium();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for RC subscription changes and propagate them to user state in real-time.
    // This handles renewals, cancellations, and grace period transitions without restart.
    const handleCustomerInfoUpdate: Parameters<typeof Purchases.addCustomerInfoUpdateListener>[0] = (info) => {
      const premium = !!info.entitlements.active[ENTITLEMENT_ID];
      setDeviceValue(IS_PREMIUM_CACHE_KEY, String(premium)).catch(() => {});
      setUser((u) => {
        if (!u) return u;
        if (u.isPremium !== premium) {
          identify(u.id, { isPremium: premium });
          track(premium ? 'subscription_activated' : 'subscription_lapsed');
        }
        return { ...u, isPremium: premium };
      });
    };
    if (purchasesReady()) Purchases.addCustomerInfoUpdateListener(handleCustomerInfoUpdate);

    // Restore existing session on cold start.
    // Hydrate isPremium from SecureStore immediately so the UI renders without flash,
    // then refresh from RC in the background.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const mapped = mapSupabaseUser(session.user);
        const cached = await getDeviceValue(IS_PREMIUM_CACHE_KEY).catch(() => null);
        setUser({ ...mapped, isPremium: cached === 'true' });
        setIsLoading(false);
        hydrateRcPremium(session.user.id)
          .then((live) => {
            setDeviceValue(IS_PREMIUM_CACHE_KEY, String(live)).catch(() => {});
            setUser((u) => (u ? { ...u, isPremium: live } : u));
          })
          .catch(() => {});
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Handle subsequent auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // PASSWORD_RECOVERY establishes a temporary session for updateUser — don't
      // treat it as a normal sign-in or the app screen will mount mid-reset-flow.
      if (event === 'PASSWORD_RECOVERY') {
        setIsLoading(false);
        return;
      }

      const mapped = session ? mapSupabaseUser(session.user) : null;

      if (event === 'SIGNED_IN' && mapped) {
        await clearUserQueryCache();
        const cached = await getDeviceValue(IS_PREMIUM_CACHE_KEY).catch(() => null);
        setUser({ ...mapped, isPremium: cached === 'true' });
        setIsLoading(false);
        identify(mapped.id, { email: mapped.email, authProvider: mapped.authProvider });
        track('user_logged_in', { provider: mapped.authProvider });
        hydrateRcPremium(mapped.id)
          .then((live) => {
            setDeviceValue(IS_PREMIUM_CACHE_KEY, String(live)).catch(() => {});
            setUser((u) => (u ? { ...u, isPremium: live } : u));
          })
          .catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        await clearUserQueryCache();
        logoutUser().catch(() => {});
        deleteDeviceValue(IS_PREMIUM_CACHE_KEY).catch(() => {});
        setUser(null);
        setIsLoading(false);
        reset();
      } else if (mapped) {
        // INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED — update profile fields but
        // preserve the RC-backed isPremium so we don't overwrite it with the Supabase default.
        setUser((u) => (u ? { ...u, ...mapped, isPremium: u.isPremium } : { ...mapped }));
        setIsLoading(false);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (purchasesReady()) Purchases.removeCustomerInfoUpdateListener(handleCustomerInfoUpdate);
    };
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
    deleteDeviceValue(LAST_LOGIN_EMAIL_KEY).catch(() => {});
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
