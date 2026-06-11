import { useAuth } from '../contexts/AuthContext';

// Dev-only accounts that bypass RevenueCat and always get premium access.
const DEV_PREMIUM_OVERRIDES = __DEV__ ? ['takis@local.dev'] : [];

export function useEntitlement() {
  const { user } = useAuth();
  const isPremium = (user?.isPremium ?? false) || DEV_PREMIUM_OVERRIDES.includes(user?.email ?? '');
  return { isPremium };
}
