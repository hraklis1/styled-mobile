import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { useProfile } from '../../hooks/useProfile';
import { useEvents } from '../../hooks/useEvents';
import { resolveAppPreferences } from '../../lib/appPreferences';
import { setHapticsEnabled } from '../../lib/haptics';
import { posthog } from '../../lib/analytics';
import { syncReminders } from '../../lib/notifications';

/**
 * Applies Settings to the running app. Render it once, inside the signed-in
 * tree. It reads the cached profile and doesn't fetch anything.
 *
 * - Haptics: flips the lib/haptics gate.
 * - Reduce motion: Reanimated's app-wide override. "Off" defers to the system
 *   setting rather than forcing motion on.
 * - Analytics: PostHog opt-out/in.
 * - Reminders: reschedules local notifications when preferences or events
 *   change, and opens a reminder's styled:// link when it is tapped.
 */
export function AppPreferencesEffects() {
  const { data: profile } = useProfile();
  const { data: events } = useEvents();
  const prefs = resolveAppPreferences(profile?.appPreferences);
  const loaded = !!profile;

  useEffect(() => { setHapticsEnabled(prefs.haptics); }, [prefs.haptics]);

  useEffect(() => {
    if (!loaded) return;
    if (prefs.analyticsOptOut) void posthog.optOut();
    else void posthog.optIn();
  }, [loaded, prefs.analyticsOptOut]);

  const reminderKey = JSON.stringify(prefs.notifications);
  const eventKey = (events ?? []).map((event) => `${event.id}:${event.date}:${event.outfitId ?? ''}`).join('|');
  useEffect(() => {
    if (!loaded) return;
    syncReminders(prefs, events ?? []).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, reminderKey, eventKey]);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('styled://')) void Linking.openURL(url);
  }, [response]);

  return <ReducedMotionConfig mode={prefs.reduceMotion ? ReduceMotion.Always : ReduceMotion.System} />;
}
