import type { SortKey } from '../hooks/useClosetFilters';
import type { Item } from '../types/item';

/** `label` is the short rail text; `title` names the section in full and identifies it. */
export type ScrubberSection = { label: string; title: string };
export type ScrubberEntry = ScrubberSection & { index: number };

type ScrubbablePiece = Pick<Item, 'name' | 'createdAt' | 'wearCount' | 'lastWornAt' | 'purchasePrice'>;

const MIN_SECTIONS = 3;
// Beyond this many months the rail gets cramped; fall back to years.
const MAX_MONTH_SECTIONS = 24;
const DAY = 24 * 60 * 60 * 1000;

export function nameInitial(name: string | null | undefined): ScrubberSection {
  const first = (name ?? '').trim().charAt(0).toUpperCase();
  const letter = /[A-Z]/.test(first) ? first : '#';
  return { label: letter, title: letter };
}

function monthOf(iso: string): ScrubberSection {
  const date = new Date(iso);
  return {
    label: date.toLocaleDateString(undefined, { month: 'short' }),
    title: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

function yearOf(iso: string): ScrubberSection {
  const year = String(new Date(iso).getFullYear());
  return { label: year, title: year };
}

function wearBand(count: number): ScrubberSection {
  if (count >= 10) return { label: '10+', title: 'Worn 10+ times' };
  if (count >= 5) return { label: '5–9', title: 'Worn 5–9 times' };
  if (count >= 1) return { label: '1–4', title: 'Worn 1–4 times' };
  return { label: 'Never', title: 'Never worn' };
}

function recencyBand(lastWornAt: string | null, now: number): ScrubberSection {
  if (!lastWornAt) return { label: 'Never', title: 'Never worn' };
  const age = now - new Date(lastWornAt).getTime();
  if (age <= 7 * DAY) return { label: 'Week', title: 'This week' };
  if (age <= 30 * DAY) return { label: 'Month', title: 'This month' };
  if (age <= 365 * DAY) return { label: 'Year', title: 'This year' };
  return { label: 'Earlier', title: 'Over a year ago' };
}

function costBand(piece: ScrubbablePiece): ScrubberSection {
  if (piece.purchasePrice == null || piece.wearCount <= 0) return { label: '—', title: 'No cost per wear yet' };
  const cpw = piece.purchasePrice / piece.wearCount;
  if (cpw < 5) return { label: '<$5', title: 'Under $5 a wear' };
  if (cpw < 20) return { label: '$5–20', title: '$5–20 a wear' };
  return { label: '$20+', title: '$20+ a wear' };
}

/** Collapses consecutive rows that share a section into one jump target each. */
function collapse<T>(rows: T[], sectionOf: (row: T) => ScrubberSection): ScrubberEntry[] {
  const entries: ScrubberEntry[] = [];
  rows.forEach((row, index) => {
    const section = sectionOf(row);
    if (entries[entries.length - 1]?.title !== section.title) entries.push({ ...section, index });
  });
  return entries;
}

/**
 * Index entries that follow the active sort, so every jump lands at the start
 * of a contiguous run. Empty when the sort yields too few sections to help.
 */
export function buildScrubberEntries(rows: ScrubbablePiece[], sortKey: SortKey, now = Date.now()): ScrubberEntry[] {
  let entries: ScrubberEntry[];
  switch (sortKey) {
    case 'name_asc':
    case 'name_desc':
      entries = collapse(rows, row => nameInitial(row.name));
      break;
    case 'newest':
    case 'oldest':
      entries = collapse(rows, row => monthOf(row.createdAt));
      if (entries.length > MAX_MONTH_SECTIONS) entries = collapse(rows, row => yearOf(row.createdAt));
      break;
    case 'most_worn':
    case 'least_worn':
      entries = collapse(rows, row => wearBand(row.wearCount ?? 0));
      break;
    case 'recently_worn':
      entries = collapse(rows, row => recencyBand(row.lastWornAt, now));
      break;
    case 'cost_per_wear':
      entries = collapse(rows, costBand);
      break;
    default:
      entries = [];
  }
  return entries.length >= MIN_SECTIONS ? entries : [];
}
