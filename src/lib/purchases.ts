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

export { Purchases };
