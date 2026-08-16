import { useProfile } from './useProfile';
import { resolveCurrencyCode } from '../lib/currency';

/**
 * The ISO 4217 currency to display prices in, inferred from the user's Home
 * location. Mirrors useTempUnit — there is no explicit currency preference to
 * check first, since currency (unlike temperature) always follows location.
 */
export function useCurrencyCode(): string {
  const { data: profile } = useProfile();
  return resolveCurrencyCode(profile?.location);
}
