import type { AppPreferences } from '../types/profile';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  haptics: true,
  reduceMotion: false,
  currency: null,
  stylistTone: 'balanced',
  adventurousness: 'balanced',
  shoppingLinksInAnswers: true,
  analyticsOptOut: false,
  notifications: {
    dailyLook: { enabled: false, time: '07:30' },
    wearLog: false,
    events: false,
  },
};

/** Fill a possibly-partial server blob with defaults (older rows store null). */
export function resolveAppPreferences(raw: Partial<AppPreferences> | null | undefined): AppPreferences {
  const value = raw ?? {};
  return {
    ...DEFAULT_APP_PREFERENCES,
    ...value,
    notifications: {
      ...DEFAULT_APP_PREFERENCES.notifications,
      ...(value.notifications ?? {}),
      dailyLook: {
        ...DEFAULT_APP_PREFERENCES.notifications.dailyLook,
        ...(value.notifications?.dailyLook ?? {}),
      },
    },
  };
}

/** Currencies the server's CURRENCY_EXAMPLES table accepts. */
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'US dollar', symbol: '$' },
  { value: 'CAD', label: 'Canadian dollar', symbol: '$' },
  { value: 'GBP', label: 'British pound', symbol: '£' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'AUD', label: 'Australian dollar', symbol: '$' },
  { value: 'NZD', label: 'New Zealand dollar', symbol: '$' },
  { value: 'JPY', label: 'Japanese yen', symbol: '¥' },
] as const;
