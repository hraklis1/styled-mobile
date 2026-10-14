/**
 * Local reminders driven by Settings → Notifications.
 *
 * Everything here is scheduled on-device: no push token and no server
 * involvement. Every sync cancels what Styled scheduled before and rebuilds it
 * from the current preferences. That makes it idempotent, so it is safe to
 * call on every profile or events change.
 */
import * as Notifications from 'expo-notifications';
import type { AppPreferences } from '../types/profile';
import type { Event } from '../types/event';
import { lentPiecesIn, lentPiecesLine, localYmd } from './lending';
import type { Item } from '../types/item';
import { LOAN_REMINDER_HOUR, planLoanReminders, type LoanForReminder } from './loanReminders';

const TAG = 'styled-reminder';
const WEAR_LOG_HOUR = 20;
const EVENT_LOOKAHEAD_DAYS = 14;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as NotificationPermission;
}

/** Ask only when the user turns a reminder on, never on launch. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: Number.isFinite(hour) ? hour : 7, minute: Number.isFinite(minute) ? minute : 30 };
}

export async function syncReminders(prefs: AppPreferences, events: readonly Event[], items: readonly Item[] = []): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((entry) => entry.content.data?.tag === TAG)
      .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier)),
  );

  const { notifications } = prefs;
  if (!notifications.dailyLook.enabled && !notifications.wearLog && !notifications.events) return;
  if ((await getNotificationPermission()) !== 'granted') return;

  if (notifications.dailyLook.enabled) {
    const { hour, minute } = parseTime(notifications.dailyLook.time);
    await Notifications.scheduleNotificationAsync({
      content: { title: "Today's look is ready", body: 'Dressed for the weather and your day.', data: { tag: TAG, url: 'styled://home' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  }

  if (notifications.wearLog) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'What did you wear today?', body: 'Log it in a tap — it sharpens tomorrow’s suggestions.', data: { tag: TAG, url: 'styled://home' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: WEAR_LOG_HOUR, minute: 0 },
    });
  }

  if (notifications.events) {
    const now = Date.now();
    const horizon = now + EVENT_LOOKAHEAD_DAYS * 86_400_000;
    for (const event of events) {
      const start = new Date(event.date);
      if (Number.isNaN(start.getTime())) continue;
      // The evening before, so there is time to plan the outfit (or get a
      // lent piece of it back).
      const remindAt = new Date(start);
      remindAt.setDate(remindAt.getDate() - 1);
      remindAt.setHours(19, 0, 0, 0);
      if (remindAt.getTime() <= now || start.getTime() > horizon) continue;
      let body: string;
      if (!event.outfitId) {
        body = 'No outfit planned yet. Want your stylist to pull one together?';
      } else {
        const lent = lentPiecesIn(event.itemIds, items);
        if (!lent.length) continue;
        body = `${lentPiecesLine(lent)}. Get ${lent.length > 1 ? 'them' : 'it'} back or swap ${lent.length > 1 ? 'them' : 'it'} before then.`;
      }
      await Notifications.scheduleNotificationAsync({
        content: { title: `Tomorrow: ${event.title}`, body, data: { tag: TAG, url: 'styled://calendar' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
      });
    }
  }
}

// ── Lent items ───────────────────────────────────────────────────────────────

const LOAN_TAG = 'styled-loan';

/**
 * Lent-item reminders (back-by day, one overdue follow-up, a month-out nudge
 * for open-ended loans), planned in lib/loanReminders. Rebuilt from scratch
 * like syncReminders, under its own tag so the two never cancel each other's
 * work.
 */
export async function syncLoanReminders(enabled: boolean, loans: readonly LoanForReminder[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((entry) => entry.content.data?.tag === LOAN_TAG)
      .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier)),
  );
  if (!enabled || !loans.length) return;
  if ((await getNotificationPermission()) !== 'granted') return;

  const now = Date.now();
  for (const reminder of planLoanReminders(loans, localYmd())) {
    const remindAt = new Date(`${reminder.day}T00:00:00`);
    remindAt.setHours(LOAN_REMINDER_HOUR, 0, 0, 0);
    if (remindAt.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.title, body: reminder.body, data: { tag: LOAN_TAG, url: reminder.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
    });
  }
}
