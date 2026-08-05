import { useMemo } from 'react';

import { OutfitCollage } from '../outfits/OutfitCollage';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { presentEventLook } from './calendar-presentation';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';

export function EventLookCollage({
  itemIds,
  allItems,
  size,
  height = size,
  borderRadius,
  outfit,
}: {
  itemIds: number[];
  allItems: Item[];
  size: number;
  height?: number;
  borderRadius?: number;
  outfit?: Outfit | null;
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

  if (outfit?.aiGeneratedImageUrl) {
    return (
      <OutfitCollage
        outfit={outfit}
        size={size}
        height={height}
        borderRadius={borderRadius}
      />
    );
  }

  return (
    <ResolvedOutfitCollage
      slots={slots}
      size={size}
      height={height}
      borderRadius={borderRadius}
    />
  );
}
