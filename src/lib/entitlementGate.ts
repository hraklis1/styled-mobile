import { Alert } from 'react-native';
import { presentPaywall } from './paywall';

export interface EnsureEntitledOptions {
  /**
   * Custom pitch shown before RC's own paywall UI. Omit to go straight to
   * `presentPaywall()` — appropriate when the paywall's own copy already
   * explains the value (e.g. hitting a numeric limit), so a second dialog
   * asking the same question first would be redundant.
   */
  title?: string;
  message?: string;
}

/**
 * Gate a premium feature behind RevenueCat's paywall, correctly handling the
 * purchase outcome — this is the ONE thing every call site duplicating this
 * flow got subtly wrong before it was pulled out here.
 *
 * Two of the three original call sites (`SuggestionsScreen`, `CalendarScreen`)
 * called `presentPaywall()` and then returned UNCONDITIONALLY, never checking
 * whether the purchase actually succeeded — so a user who completed a
 * purchase from either of those screens still got bounced out, only to see
 * the feature unlocked on their NEXT tap. `GlobalAIStylistContext` had it
 * right (check the result, continue on success); this adopts that behaviour
 * everywhere.
 *
 * Returns `true` when the caller should proceed: the user was already
 * premium (call this and it resolves true immediately — no dialog shown), or
 * they just completed a purchase. Returns `false` if they declined the
 * pre-paywall pitch, closed the paywall without buying, or the purchase
 * failed.
 *
 * The SERVER remains the actual authority on access — this only gates the
 * client-side attempt at a nicer moment than a 403 mid-request. A stale
 * client that thinks a user is entitled when the server disagrees still gets
 * refused server-side; see `src/lib/api.ts`'s response interceptor.
 */
export async function ensureEntitled(
  isPremium: boolean,
  options: EnsureEntitledOptions = {},
): Promise<boolean> {
  if (isPremium) return true;

  if (options.title) {
    const shouldContinue = await new Promise<boolean>((resolve) => {
      Alert.alert(options.title!, options.message, [
        { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'See Plans', onPress: () => resolve(true) },
      ]);
    });
    if (!shouldContinue) return false;
  }

  return presentPaywall();
}
