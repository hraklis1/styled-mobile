// Resuming a thread is the default for the generic stylist open, so a returning
// user can land on a conversation from days ago. A day divider above the first
// message of each calendar day makes that obvious at a glance — the same cue
// iMessage and Slack use — instead of leaving stale turns looking current.
//
// The reader is always standing in today, and a divider is drawn exactly when
// the transcript steps off the day the reader is standing on. Everything else
// here is that one sentence.

/** Calendar-day key in the device's local timezone (not UTC — a late-night
 *  message must not be filed under tomorrow). */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Label for a divider above a message sent at `timestamp`, relative to `now`.
 * Recent days read as words; anything older reads as a date, with the year
 * added only once it stops being obvious.
 */
export function dayDividerLabel(timestamp: number, now: number = Date.now()): string {
  const then = new Date(timestamp);
  const today = new Date(now);
  const daysApart = Math.round((startOfDay(today) - startOfDay(then)) / 86_400_000);

  if (daysApart <= 0) return 'Today';
  if (daysApart === 1) return 'Yesterday';
  if (daysApart < 7) return then.toLocaleDateString(undefined, { weekday: 'long' });
  if (then.getFullYear() === today.getFullYear()) {
    return then.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Which messages need a divider drawn above them, keyed by message id.
 *
 * One rule: a divider marks a departure from the day the reader is in. The walk
 * therefore starts on today rather than on nothing, which is what an open chat
 * is anchored to, and every consequence falls out of that:
 *
 * - A thread begun today draws no leading divider (its first message does not
 *   depart from today) — "Today" above a conversation you just started is noise.
 * - A resumed thread leads with the day it started on, which is the whole point.
 * - A message with no `createdAt` is being sent right now, so it reads as today
 *   and puts a "Today" divider after the turns loaded from the server.
 */
export function dayDividers(
  messages: { id: string; createdAt?: number }[],
  now: number = Date.now(),
): Map<string, string> {
  const dividers = new Map<string, string>();
  let previousKey = dayKey(new Date(now));

  for (const message of messages) {
    const timestamp = message.createdAt ?? now;
    const key = dayKey(new Date(timestamp));
    if (key !== previousKey) {
      dividers.set(message.id, dayDividerLabel(timestamp, now));
    }
    previousKey = key;
  }

  return dividers;
}
