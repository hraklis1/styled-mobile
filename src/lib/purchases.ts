import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export const ENTITLEMENT_ID = 'premium';
export const IS_PREMIUM_CACHE_KEY = 'rc_is_premium';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let _configured = false;
export function purchasesReady(): boolean {
  return _configured;
}

export function initPurchases(): void {
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  _configured = true;
}

export async function loginUser(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}

export async function logoutUser(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if the current user is already anonymous
  }
}

export async function getIsPremium(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export interface SubscriptionInfo {
  willRenew: boolean;
  /** Null for a lifetime/non-expiring entitlement, or when there is none active. */
  renewsAt: Date | null;
}

/**
 * When the active subscription renews (or lapses, if cancelled) — read
 * directly from RC's own CustomerInfo rather than the server, since RC is
 * already the source of truth the SDK holds on-device. This is deliberately
 * a DIFFERENT clock from the server's `creditsRefillAt`: an annual
 * subscriber refills credits every 30 days but renews once a year, so a
 * screen showing both must never derive one from the other.
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  try {
    const info = await Purchases.getCustomerInfo();
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    if (!entitlement) return { willRenew: false, renewsAt: null };
    return {
      willRenew: entitlement.willRenew,
      renewsAt: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
    };
  } catch {
    return { willRenew: false, renewsAt: null };
  }
}

export { Purchases };
