import { useCallback } from 'react';
import { useProfile, useUpdateProfile } from './useProfile';
import { resolveAppPreferences } from '../lib/appPreferences';
import type { AppPreferences } from '../types/profile';

type Patch = Partial<Omit<AppPreferences, 'notifications'>> & {
  notifications?: Partial<Omit<AppPreferences['notifications'], 'dailyLook'>> & {
    dailyLook?: Partial<AppPreferences['notifications']['dailyLook']>;
  };
};

/**
 * App preferences apply the moment they change. Unlike the style profile these
 * are switches, not a form, so there is no Save button. The full object is sent
 * each time, because the server replaces the jsonb blob.
 */
export function useAppPreferences() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const prefs = resolveAppPreferences(profile?.appPreferences);

  const setPrefs = useCallback((patch: Patch) => {
    const next = resolveAppPreferences({
      ...prefs,
      ...patch,
      notifications: {
        ...prefs.notifications,
        ...(patch.notifications ?? {}),
        dailyLook: { ...prefs.notifications.dailyLook, ...(patch.notifications?.dailyLook ?? {}) },
      },
    } as AppPreferences);
    update.mutate({ appPreferences: next });
  }, [prefs, update]);

  return { prefs, setPrefs, isSaving: update.isPending };
}
