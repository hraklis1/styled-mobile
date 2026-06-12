import type { ItemCategory } from '../../types/item';

export const MAX_OUTFIT_MOSAIC_SLOTS = 9;

const CATEGORY_PRIORITY: Record<ItemCategory, number> = {
  full_body: 0,
  top: 1,
  outerwear: 2,
  bottom: 3,
  shoes: 4,
  accessory: 5,
  valuables: 6,
};

export type MosaicRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function getOutfitCategoryPriority(category: ItemCategory | null): number {
  return category ? CATEGORY_PRIORITY[category] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
}

function makeRows(columnsPerRow: number[]): MosaicRect[] {
  const rowHeight = 1 / columnsPerRow.length;
  return columnsPerRow.flatMap((columns, row) =>
    Array.from({ length: columns }, (_, column) => ({
      left: column / columns,
      top: row * rowHeight,
      width: 1 / columns,
      height: rowHeight,
    })),
  );
}

export function getOutfitMosaicRects(count: number): MosaicRect[] {
  switch (Math.min(Math.max(count, 0), MAX_OUTFIT_MOSAIC_SLOTS)) {
    case 0:
      return [];
    case 1:
      return [{ left: 0, top: 0, width: 1, height: 1 }];
    case 2:
      return makeRows([2]);
    case 3:
      return [
        { left: 0, top: 0, width: 0.58, height: 1 },
        { left: 0.58, top: 0, width: 0.42, height: 0.5 },
        { left: 0.58, top: 0.5, width: 0.42, height: 0.5 },
      ];
    case 4:
      return makeRows([2, 2]);
    case 5:
      return [
        { left: 0, top: 0, width: 0.5, height: 1 },
        { left: 0.5, top: 0, width: 0.25, height: 0.5 },
        { left: 0.75, top: 0, width: 0.25, height: 0.5 },
        { left: 0.5, top: 0.5, width: 0.25, height: 0.5 },
        { left: 0.75, top: 0.5, width: 0.25, height: 0.5 },
      ];
    case 6:
      return makeRows([3, 3]);
    case 7:
      return makeRows([3, 4]);
    case 8:
      return makeRows([4, 4]);
    default:
      return makeRows([3, 3, 3]);
  }
}
