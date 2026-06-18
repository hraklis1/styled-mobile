import type { Item } from './item';
import type { Outfit } from './outfit';
import type { WishlistEntry } from '../lib/wishlist';

/**
 * A Pinterest-style collection. Membership is three explicit id arrays:
 * items/outfits reference server entities by integer id, wishlist references
 * the client-minted string id. `coverImageUrl` is a server-baked 2x2 composite.
 */
export type Board = {
  id: number;
  userId: number;
  name: string;
  coverImageUrl: string | null;
  coverHash: string | null;
  itemIds: number[];
  outfitIds: number[];
  wishlistIds: string[];
  storeFindIds?: string[];
  storeFinds?: import('./storeFind').StoreFind[];
  createdAt: string;
};

/**
 * Unified UI type the BoardDetail feed maps every saved reference into, so a
 * single FlashList can render a mixed grid of items, outfits, and wishlist tiles.
 */
export type BoardFeedItem =
  | { kind: 'item'; key: string; item: Item }
  | { kind: 'outfit'; key: string; outfit: Outfit }
  | { kind: 'wishlist'; key: string; entry: WishlistEntry }
  | { kind: 'storeFind'; key: string; storeFind: import('./storeFind').StoreFind };
