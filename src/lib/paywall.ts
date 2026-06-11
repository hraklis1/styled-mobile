import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

/**
 * Present the RevenueCat native paywall and return true if the user
 * purchased or restored a subscription, false otherwise.
 */
export async function presentPaywall(): Promise<boolean> {
  try {
    const result = await RevenueCatUI.presentPaywall();
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch {
    return false;
  }
}
