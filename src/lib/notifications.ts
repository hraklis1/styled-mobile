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

export async function syncReminders(prefs: AppPreferences, events: readonly Event[]): Promise<void> {
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
      if (Number.isNaN(start.getTime()) || event.outfitId) continue;
      // The evening before, so there is time to plan the outfit.
      const remindAt = new Date(start);
      remindAt.setDate(remindAt.getDate() - 1);
      remindAt.setHours(19, 0, 0, 0);
      if (remindAt.getTime() <= now || start.getTime() > horizon) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Tomorrow: ${event.title}`,
          body: 'No outfit planned yet. Want your stylist to pull one together?',
          data: { tag: TAG, url: 'styled://calendar' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
      });
    }
  }
}

// ── Lent items ───────────────────────────────────────────────────────────────

const LOAN_TAG = 'styled-loan';
const LOAN_REMINDER_HOUR = 10;
/** iOS keeps at most 64 pending local notifications; leave room for the rest. */
const MAX_LOAN_REMINDERS = 30;

type LoanForReminder = { itemName: string; contactName: string | null; dueBack: string };

/**
 * One reminder per back-by day, at 10am, naming who has what. Rebuilt from
 * scratch like syncReminders, under its own tag so the two never cancel each
 * other's work.
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

  const byDay = new Map<string, LoanForReminder[]>();
  for (const loan of loans) byDay.set(loan.dueBack, [...(byDay.get(loan.dueBack) ?? []), loan]);
  const now = Date.now();
  const days = [...byDay.keys()].sort().slice(0, MAX_LOAN_REMINDERS);
  for (const day of days) {
    const remindAt = new Date(`${day}T00:00:00`);
    remindAt.setHours(LOAN_REMINDER_HOUR, 0, 0, 0);
    if (remindAt.getTime() <= now) continue;
    const due = byDay.get(day)!;
    const [first] = due;
    const title = due.length === 1
      ? `${first.itemName} is due back today`
      : `${due.length} lent pieces are due back today`;
    const body = due.length === 1
      ? (first.contactName ? `${first.contactName} has it. A quick nudge?` : 'Time to get it back.')
      : due.map((l) => (l.contactName ? `${l.itemName} (${l.contactName})` : l.itemName)).join(', ');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { tag: LOAN_TAG, url: 'styled://lent-out' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
    });
  }
}
