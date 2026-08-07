import { ITEM_CATEGORIES, type ItemCategory } from '../types/item';
import type { CreateItemInput } from '../hooks/useItems';
import type { OutfitScanResult } from '../hooks/useOutfitLogs';

export type ScanSelections = Record<number, number>;

export function normalizeScanCategory(value: string | null | undefined): ItemCategory {
  const normalized = value?.trim().toLowerCase();
  return ITEM_CATEGORIES.includes(normalized as ItemCategory)
    ? normalized as ItemCategory
    : 'top';
}

export function initialScanSelections(results: OutfitScanResult[]): ScanSelections {
  return results.reduce<ScanSelections>((selected, result, index) => {
    if (result.confidence === 'High' && result.match_id !== null) {
      selected[index] = result.match_id;
    }
    return selected;
  }, {});
}

export function mergeUniqueItemIds(current: number[], additions: number[]): number[] {
  return Array.from(new Set([...current, ...additions]));
}

export function resolvedScanItemIds(selections: ScanSelections, skipped: Set<number>): number[] {
  return Object.entries(selections)
    .filter(([index]) => !skipped.has(Number(index)))
    .map(([, itemId]) => itemId);
}

export function buildNewClosetItemInput(
  result: OutfitScanResult,
  overrides?: Partial<Pick<CreateItemInput, 'name' | 'brand' | 'category' | 'color'>>,
): CreateItemInput {
  const suggested = result.suggested_metadata;
  return {
    name: overrides?.name?.trim() || suggested.name?.trim() || result.detected_type,
    brand: overrides?.brand?.trim() || null,
    category: normalizeScanCategory(overrides?.category ?? suggested.category),
    color: overrides?.color?.trim() || suggested.color?.trim() || null,
    material: suggested.material ?? null,
    style: suggested.style ?? null,
    imageUrl: result.crop ?? null,
    needsDetails: true,
  };
}

export function unresolvedScanIndexes(
  results: OutfitScanResult[],
  selections: ScanSelections,
  skipped: Set<number>,
): number[] {
  return results
    .map((_, index) => index)
    .filter((index) => selections[index] === undefined && !skipped.has(index));
}

export function scanResolutionCounts(
  results: OutfitScanResult[],
  selections: ScanSelections,
  skipped: Set<number>,
  createdIndexes: Set<number>,
) {
  const selectedIndexes = Object.keys(selections)
    .map(Number)
    .filter((index) => !skipped.has(index));
  const newCount = selectedIndexes.filter((index) => createdIndexes.has(index)).length;
  const matchedCount = selectedIndexes.length - newCount;
  return {
    detected: results.length,
    matched: matchedCount,
    new: newCount,
    skipped: skipped.size,
    unresolved: unresolvedScanIndexes(results, selections, skipped).length,
  };
}
