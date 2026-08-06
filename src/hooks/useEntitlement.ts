import * as Device from 'expo-device';

import { useAuth } from '../contexts/AuthContext';

// Dev-only accounts that bypass RevenueCat and always get premium access.
const DEV_PREMIUM_OVERRIDES = __DEV__ ? ['takis@local.dev'] : [];
const SIMULATOR_HAS_PREMIUM = __DEV__ && !Device.isDevice;

// Beta escape hatch, deliberately NOT __DEV__-gated so it applies to release
// builds. The server has a matching BETA_UNLOCK_ALL flag; both must be set,
// since the API enforces premium independently of this hook.
const BETA_UNLOCK_ALL = process.env.EXPO_PUBLIC_BETA_UNLOCK_ALL === 'true';

export function useEntitlement() {
  const { user } = useAuth();
  const isPremium =
    BETA_UNLOCK_ALL ||
    SIMULATOR_HAS_PREMIUM ||
    (user?.isPremium ?? false) ||
    DEV_PREMIUM_OVERRIDES.includes(user?.email ?? '');
  return { isPremium };
}
