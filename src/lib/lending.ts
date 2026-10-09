import type { CoverImageVariant, Item } from '../types/item';
import { isAvailableNow } from './availability';

export type LendRelationship = 'friend' | 'family' | 'partner' | 'colleague' | 'other';

export type LendContact = {
  id: number;
  name: string;
  relationship: LendRelationship;
  createdAt: string;
};

/** One row of GET /api/loans. returnedAt null = the item's open loan. */
export type ItemLoan = {
  id: number;
  itemId: number;
  contactId: number | null;
  lentAt: string;
  dueBack: string | null;
  returnedAt: string | null;
  itemName: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  cutoutUrl: string | null;
  polishedUrl: string | null;
  coverImageVariant: CoverImageVariant;
};

export const LEND_RELATIONSHIPS: { id: LendRelationship; label: string }[] = [
  { id: 'friend', label: 'Friend' },
  { id: 'family', label: 'Family' },
  { id: 'partner', label: 'Partner' },
  { id: 'colleague', label: 'Colleague' },
  { id: 'other', label: 'Other' },
];

export function relationshipLabel(relationship: LendRelationship): string {
  return LEND_RELATIONSHIPS.find((r) => r.id === relationship)?.label ?? 'Other';
}

export function isLentNow(item: Item): boolean {
  return item.availability === 'lent' && !isAvailableNow(item);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The user's local calendar day as YYYY-MM-DD; loan dates are stored this way. */
export function localYmd(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A YYYY-MM-DD read at local noon, so it never shifts a day across zones. */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToDate(toYmd).getTime() - ymdToDate(fromYmd).getTime()) / 86_400_000);
}

/** "Oct 9", or "Oct 9, 2025" outside the current year. */
export function formatLoanDate(ymd: string | null | undefined): string | null {
  if (!ymd) return null;
  const d = ymdToDate(ymd);
  if (isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** "3 days", "2 weeks", "4 months" — how long a loan lasted or has lasted. */
export function formatSpan(days: number): string {
  if (days < 1) return 'same day';
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.round(days / 7), 'week');
  return plural(Math.round(days / 30), 'month');
}

/** Status line for an open loan: "Since Oct 2 · back by Oct 16" / "· 3 days overdue". */
export function openLoanStatus(loan: Pick<ItemLoan, 'lentAt' | 'dueBack'>, today = localYmd()): { text: string; overdue: boolean } {
  const since = `Since ${formatLoanDate(loan.lentAt)}`;
  if (!loan.dueBack) return { text: since, overdue: false };
  const left = daysBetween(today, loan.dueBack);
  if (left < 0) return { text: `${since} · ${plural(-left, 'day')} overdue`, overdue: true };
  if (left === 0) return { text: `${since} · due back today`, overdue: false };
  return { text: `${since} · back by ${formatLoanDate(loan.dueBack)}`, overdue: false };
}

/** "Oct 1 – Oct 9 · 8 days" for a returned loan. */
export function pastLoanRange(loan: Pick<ItemLoan, 'lentAt' | 'returnedAt'>): string {
  const end = loan.returnedAt ?? loan.lentAt;
  return `${formatLoanDate(loan.lentAt)} – ${formatLoanDate(end)} · ${formatSpan(daysBetween(loan.lentAt, end))}`;
}

/** Thumbnail fields in the shape lib/itemImage expects. */
export function loanImageFields(loan: ItemLoan) {
  return {
    imageUrl: loan.imageUrl, thumbUrl: loan.thumbUrl, cutoutUrl: loan.cutoutUrl,
    polishedUrl: loan.polishedUrl, coverImageVariant: loan.coverImageVariant,
  };
}

/**
 * Opens the iOS contact picker and returns the chosen person's name. The
 * picker runs out of process, so no Contacts permission is requested and only
 * the one picked contact reaches the app. The legacy API is used on purpose:
 * the new one returns an id and reads the name from the address book, which
 * would need full permission. Resolves null on cancel; throws when the native
 * module is missing (a build from before expo-contacts was added).
 */
export async function pickNameFromContacts(): Promise<string | null> {
  // Required lazily so an older binary without the module only fails here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { presentContactPickerAsync } = require('expo-contacts/legacy') as typeof import('expo-contacts/legacy');
  const contact = await presentContactPickerAsync();
  if (!contact) return null;
  const full = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  const name = (contact.nickname || contact.name || full || contact.company || '').replace(/\s+/g, ' ').trim();
  return name || null;
}
