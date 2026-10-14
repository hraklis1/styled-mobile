import { addDaysYmd, formatLoanDate } from './lending';

/** One open loan, as the reminder planner needs it. Dates are local YYYY-MM-DD. */
export type LoanForReminder = {
  loanId: number;
  itemName: string;
  contactName: string | null;
  note?: string | null;
  lentAt: string;
  dueBack: string | null;
};

export type LoanReminderKind = 'due' | 'overdue' | 'longOut';

export type PlannedLoanReminder = {
  kind: LoanReminderKind;
  /** Local day it fires, at LOAN_REMINDER_HOUR. */
  day: string;
  title: string;
  body: string;
  /** Opens Lent Out; with one loan it also opens the "remind them" message. */
  url: string;
};

export const LOAN_REMINDER_HOUR = 10;
/** One follow-up this many days after a missed back-by date, then quiet. */
export const OVERDUE_FOLLOW_UP_DAYS = 3;
/** A loan with no back-by date gets one nudge after this long. */
export const LONG_OUT_DAYS = 30;
/** iOS keeps at most 64 pending local notifications; leave room for the rest. */
export const MAX_LOAN_REMINDERS = 40;

const lower = (name: string) => name.toLowerCase();

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function withNote(text: string, note?: string | null) {
  return note ? `${text} (${note})` : text;
}

function describe(kind: LoanReminderKind, loans: LoanForReminder[]): { title: string; body: string } {
  const [first] = loans;
  if (loans.length > 1) {
    const title = kind === 'due' ? `${loans.length} lent pieces are due back today`
      : kind === 'overdue' ? `${loans.length} lent pieces are past their back-by date`
        : `${loans.length} pieces have been out a month`;
    const body = loans.map((l) => (l.contactName ? `${l.itemName} (${l.contactName})` : l.itemName)).join(', ');
    return { title, body };
  }
  const who = first.contactName;
  if (kind === 'due') {
    return {
      title: `${first.itemName} is due back today`,
      body: withNote(who ? `${who} has it` : 'Time to get it back', first.note) + (who ? '. A quick nudge?' : '.'),
    };
  }
  if (kind === 'overdue') {
    return {
      title: `${first.itemName} is still out`,
      body: withNote(`It was due back ${formatLoanDate(first.dueBack)}${who ? ` and ${who} still has it` : ''}`, first.note)
        + (who ? '. Want to send a reminder?' : '.'),
    };
  }
  return {
    title: `${first.itemName} has been out a month`,
    body: withNote(who ? `${who} has had it since ${formatLoanDate(first.lentAt)}` : `Lent ${formatLoanDate(first.lentAt)}`, first.note)
      + (who ? '. Want to check in?' : '.'),
  };
}

/**
 * Every reminder the open loans call for, soonest first: the back-by day, one
 * follow-up a few days after a missed back-by, and one "it's been a month"
 * for a loan with no back-by date. Loans sharing a day and kind share one
 * notification. Days already past `today` are left out; at most `max`.
 */
export function planLoanReminders(
  loans: readonly LoanForReminder[],
  today: string,
  max = MAX_LOAN_REMINDERS,
): PlannedLoanReminder[] {
  const groups = new Map<string, { kind: LoanReminderKind; day: string; loans: LoanForReminder[] }>();
  const add = (kind: LoanReminderKind, day: string, loan: LoanForReminder) => {
    if (day < today) return;
    const key = `${day}|${kind}`;
    const group = groups.get(key) ?? { kind, day, loans: [] };
    group.loans.push(loan);
    groups.set(key, group);
  };
  for (const loan of loans) {
    if (loan.dueBack) {
      add('due', loan.dueBack, loan);
      add('overdue', addDaysYmd(loan.dueBack, OVERDUE_FOLLOW_UP_DAYS), loan);
    } else {
      add('longOut', addDaysYmd(loan.lentAt, LONG_OUT_DAYS), loan);
    }
  }
  const order: Record<LoanReminderKind, number> = { due: 0, overdue: 1, longOut: 2 };
  return [...groups.values()]
    .sort((a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind])
    .slice(0, max)
    .map(({ kind, day, loans: group }) => ({
      kind,
      day,
      ...describe(kind, group),
      url: group.length === 1 ? `styled://lent-out?nudge=${group[0].loanId}` : 'styled://lent-out',
    }));
}

/**
 * The text for "Remind them": friendly, short, and ready to send as is.
 * `items` are the pieces that person has; a back-by date in the past is
 * mentioned as such.
 */
export function nudgeMessage(
  contactName: string | null,
  items: { name: string; dueBack?: string | null }[],
  today: string,
): string {
  const hi = contactName ? `Hi ${contactName.split(' ')[0]}!` : 'Hi!';
  const what = list(items.map((i) => `my ${lower(i.name)}`));
  const dues = items.map((i) => i.dueBack).filter((d): d is string => !!d).sort();
  const due = dues[0] ?? null;
  const ask = !due ? 'Could I have it back when you get a chance?'
    : due < today ? `It was due back ${formatLoanDate(due)}. Could you get it back to me soon?`
      : `Could I have it back by ${formatLoanDate(due)}?`;
  const pronounAsk = items.length > 1 ? ask.replace(/\bit\b/g, 'them') : ask;
  return `${hi} Just a reminder that you've got ${what}. ${pronounAsk} Thanks!`;
}
