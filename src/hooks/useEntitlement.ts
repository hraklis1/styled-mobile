import * as Device from 'expo-device';

import { useAuth } from '../contexts/AuthContext';
import { useProfile } from './useProfile';
import type { PlanTier } from '../types/profile';

// Dev-only accounts that bypass RevenueCat and always get premium access.
const DEV_PREMIUM_OVERRIDES = __DEV__ ? ['takis@local.dev'] : [];
const SIMULATOR_HAS_PREMIUM = __DEV__ && !Device.isDevice;

/**
 * Server-authoritative entitlement, with RevenueCat's own read as an
 * optimistic overlay.
 *
 * `useProfile()`'s `planTier` is what the server will actually honour on
 * every metered request — it comes from `user_credits`, updated by
 * RevenueCat webhooks and reconciliation, not by anything the client claims.
 * `user.isPremium` (from `useAuth`, populated by the RevenueCat SDK) is kept
 * as an OR so a fresh purchase unblocks the UI immediately, before the
 * webhook has landed and the next `/api/profile` refetch has picked it up —
 * the server remains the one that enforces access either way, so this can
 * only ever unlock the UI a little early, never grant something the backend
 * will refuse.
 *
 * `DEV_PREMIUM_OVERRIDES` / `SIMULATOR_HAS_PREMIUM` are local-dev-only and
 * never apply to a release build — unlike the retired `BETA_UNLOCK_ALL`
 * escape hatch, which is gone: grandfathered accounts now carry a real
 * `planTier` from the server (migrations/0044), so there is nothing left for
 * a client-side "unlock everyone" flag to do.
 */
export function useEntitlement() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const planTier: PlanTier | undefined = profile?.planTier ?? undefined;
  const isPremium =
    SIMULATOR_HAS_PREMIUM ||
    (planTier != null && planTier !== 'free') ||
    (user?.isPremium ?? false) ||
    DEV_PREMIUM_OVERRIDES.includes(user?.email ?? '');

  return {
    isPremium,
    planTier,
    credits: profile?.credits ?? null,
    monthlyGrant: profile?.monthlyGrant ?? null,
    creditsRefillAt: profile?.creditsRefillAt ?? null,
    freeUsage: profile?.freeUsage ?? null,
    /** Credit price for a meter, or 0 if unknown (never blocks on a missing price). */
    costOf: (meter: string): number => profile?.meterCosts?.[meter] ?? 0,
    isLoading: profile === undefined,
  };
}
