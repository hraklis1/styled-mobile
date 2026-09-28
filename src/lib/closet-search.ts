import { CATEGORY_LABELS, SEASON_LABELS, OCCASION_LABELS, SLEEVE_LENGTH_LABELS, type Item } from '../types/item';
import type { Outfit } from '../types/outfit';
import { parseMaterialString } from './colorUtils';

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
const aliases = [['pants', 'trousers'], ['sneakers', 'trainers'], ['gray', 'grey'], ['tee', 't shirt', 'tshirt'], ['sweater', 'jumper']];
function canonical(value: string): string {
  let text = normalizeSearch(value);
  aliases.forEach(group => group.forEach(alias => {
    text = text.replace(new RegExp(`\\b${alias}\\b`, 'g'), group[0]);
  }));
  return text;
}
export function searchRecord(fields: (string | null | undefined)[]): string {
  const text = fields.filter(Boolean).join(' ');
  return `${normalizeSearch(text)} ${canonical(text)}`;
}
export function matchesSearch(record: string, query: string): boolean {
  return canonical(query).split(' ').filter(Boolean).every(word => record.includes(word));
}
export function pieceSearchRecord(item: Item): string {
  return searchRecord([item.name, item.brand, item.category && CATEGORY_LABELS[item.category], item.subcategory,
    item.color, item.colorNormalized, ...(item.colorPalette ?? []), ...parseMaterialString(item.material ?? ''),
    ...(item.tags ?? []), item.style, ...(item.seasons ?? []).map(s => SEASON_LABELS[s as keyof typeof SEASON_LABELS] ?? s),
    ...(item.occasions ?? []).map(s => OCCASION_LABELS[s as keyof typeof OCCASION_LABELS] ?? s), item.pattern, item.fit,
    item.neckline, item.sleeveLength && SLEEVE_LENGTH_LABELS[item.sleeveLength]]);
}
export function outfitSearchRecord(outfit: Outfit): string { return searchRecord([outfit.name, ...(outfit.tags ?? [])]); }
export function addRecentSearch(previous: string[], query: string): string[] {
  const label = query.trim().replace(/\s+/g, ' ');
  if (!normalizeSearch(label)) return previous;
  return [label, ...previous.filter(value => normalizeSearch(value) !== normalizeSearch(label))].slice(0, 5);
}

export function addSearchFilter(previous: string[], query: string): string[] {
  const label = query.trim().replace(/\s+/g, ' ');
  const key = normalizeSearch(label);
  if (!key || previous.some(value => normalizeSearch(value) === key)) return previous;
  return [...previous, label];
}

export function combineSearchFilters(filters: string[], draft: string): string {
  return [...filters, draft].filter(value => normalizeSearch(value)).join(' ');
}
