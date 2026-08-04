import { useMemo } from 'react';

import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { presentEventLook } from './calendar-presentation';
import type { Item } from '../../types/item';

export function EventLookCollage({
  itemIds,
  allItems,
  size,
  height = size,
  borderRadius,
}: {
  itemIds: number[];
  allItems: Item[];
  size: number;
  height?: number;
  borderRadius?: number;
}) {
  const pieces = useMemo(
    () => presentEventLook(itemIds, allItems),
    [allItems, itemIds],
  );

  const slots = useMemo(
    () => pieces.map((piece) => ({
      key: piece.key,
      uri: piece.uri,
      contentFit: piece.contentFit,
      ghost: piece.ghost,
    })),
    [pieces],
  );

  return (
    <ResolvedOutfitCollage
      slots={slots}
      size={size}
      height={height}
      borderRadius={borderRadius}
    />
  );
}
