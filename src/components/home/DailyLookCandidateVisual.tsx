import { forwardRef } from 'react';

import { LookPlatePager, type LookPlatePagerHandle, type LookPlatePiece } from './LookPlatePager';
import { categoryRank } from './dailyLookCopy';
import type { DailyLookCandidate, DailyLookMissingEssential } from '../../hooks/useDailyLook';
import type { Item } from '../../types/item';

type Props = {
  candidate: DailyLookCandidate;
  gap: DailyLookMissingEssential;
  items: Item[];
  width: number;
  height: number;
  borderRadius?: number;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onOpen?: () => void;
  onFindPiece?: () => void;
};

/** The owned pieces of a candidate, outerwear down to accessories. */
export function candidatePieces(candidate: DailyLookCandidate, items: Item[]): LookPlatePiece[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return candidate.foundationItemIds
    .map((entry) => ({ id: entry.id, category: entry.category.replaceAll('_', ' '), item: itemMap.get(entry.id) }))
    .sort((a, b) => categoryRank(a.item?.category ?? a.category) - categoryRank(b.item?.category ?? b.category));
}

/**
 * A look that has no flat lay: the owned pieces as swipeable plates, and the
 * missing piece as a plate of its own — last for one-piece-away looks, first
 * for a priority gap.
 */
export const DailyLookCandidateVisual = forwardRef<LookPlatePagerHandle, Props>(function DailyLookCandidateVisual({
  candidate, gap, items, width, height, borderRadius = 0, initialIndex, onIndexChange, onOpen, onFindPiece,
}, ref) {
  return (
    <LookPlatePager
      ref={ref}
      pieces={candidatePieces(candidate, items)}
      gap={gap}
      gapFirst={candidate.readinessStatus === 'priority'}
      width={width}
      height={height}
      borderRadius={borderRadius}
      initialIndex={initialIndex}
      onIndexChange={onIndexChange}
      onPressPiece={onOpen}
      onPressGap={onFindPiece ?? onOpen}
    />
  );
});
