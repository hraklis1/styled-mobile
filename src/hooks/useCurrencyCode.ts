import { useProfile } from './useProfile';
import { resolveCurrencyCode } from '../lib/currency';

/**
 * The ISO 4217 currency to display prices in. An explicit choice in Settings →
 * Stylist → Units wins; otherwise it is inferred from the Home location. The
 * server applies the same precedence (resolveStylistCurrency), so prices the
 * stylist writes and prices the app formats agree.
 */
export function useCurrencyCode(): string {
  const { data: profile } = useProfile();
  return profile?.appPreferences?.currency ?? resolveCurrencyCode(profile?.location);
}
