import * as Device from 'expo-device';

import { useAuth } from '../contexts/AuthContext';

// Dev-only accounts that bypass RevenueCat and always get premium access.
const DEV_PREMIUM_OVERRIDES = __DEV__ ? ['takis@local.dev'] : [];
const SIMULATOR_HAS_PREMIUM = __DEV__ && !Device.isDevice;

export function useEntitlement() {
  const { user } = useAuth();
  const isPremium =
    SIMULATOR_HAS_PREMIUM ||
    (user?.isPremium ?? false) ||
    DEV_PREMIUM_OVERRIDES.includes(user?.email ?? '');
  return { isPremium };
}
