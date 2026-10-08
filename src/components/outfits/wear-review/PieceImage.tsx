import { itemImageContentFit, itemImageUri } from '../../../lib/itemImage';
import type { Item } from '../../../types/item';
import { PieceThumb } from '../../wardrobe/scan-review/PieceThumb';

export { LocateInPhoto } from '../../wardrobe/scan-review/PieceThumb';

/**
 * A wardrobe item or detected piece on the shared thumbnail plate. A
 * detection shows its background-intact crop, filling the tile; the cutout is
 * the fallback.
 */
export function PieceImage({ item, cropUrl, cutoutUrl, width, height }: {
  item?: Item; cropUrl?: string | null; cutoutUrl?: string | null; width?: number | `${number}%`; height?: number;
}) {
  const uri = item ? itemImageUri(item) : cropUrl ?? cutoutUrl;
  const fit = item ? itemImageContentFit(item) : cropUrl ? 'cover' : 'contain';
  return <PieceThumb uri={uri} fit={fit} width={width} height={height} recyclingKey={item ? String(item.id) : undefined} />;
}
