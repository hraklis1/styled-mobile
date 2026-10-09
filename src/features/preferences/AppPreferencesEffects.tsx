import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { useProfile } from '../../hooks/useProfile';
import { useEvents } from '../../hooks/useEvents';
import { resolveAppPreferences } from '../../lib/appPreferences';
import { setHapticsEnabled } from '../../lib/haptics';
import { posthog } from '../../lib/analytics';
import { syncLoanReminders, syncReminders } from '../../lib/notifications';
import { useLendContacts, useLoans } from '../../hooks/useLendContacts';

/**
 * Applies Settings to the running app. Render it once, inside the signed-in
 * tree. It reads the cached profile and doesn't fetch anything.
 *
 * - Haptics: flips the lib/haptics gate.
 * - Reduce motion: Reanimated's app-wide override. "Off" defers to the system
 *   setting rather than forcing motion on.
 * - Analytics: PostHog opt-out/in.
 * - Reminders: reschedules local notifications when preferences, events or
 *   lent items' back-by dates change, and opens a reminder's styled:// link when it is tapped.
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

  // Lent-item reminders: only loans with a back-by date, and only while the
  // setting is on, so the queries stay idle for everyone else.
  const loansOn = loaded && prefs.notifications.loans;
  const { data: loans } = useLoans(loansOn);
  const { data: contacts } = useLendContacts(loansOn);
  const loanKey = (loans ?? [])
    .filter((l) => !l.returnedAt && l.dueBack)
    .map((l) => `${l.id}:${l.dueBack}:${l.contactId ?? ''}:${contacts?.find((c) => c.id === l.contactId)?.name ?? ''}`)
    .join('|');
  useEffect(() => {
    if (!loaded) return;
    const due = (loans ?? [])
      .filter((l) => !l.returnedAt && l.dueBack)
      .map((l) => ({
        itemName: l.itemName,
        contactName: contacts?.find((c) => c.id === l.contactId)?.name ?? null,
        dueBack: l.dueBack!,
      }));
    syncLoanReminders(loansOn, due).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, loansOn, loanKey]);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('styled://')) void Linking.openURL(url);
  }, [response]);

  // Reanimated already follows the system setting by default. Only mount an
  // override when requested; unmounting restores the previous system behavior.
  return prefs.reduceMotion ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null;
}
