import { CuratedItemRail } from './CuratedItemRail';
import type { OfferContext, OfferStatus, ProductOffer } from '../../types/commerce';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';
export function ShoppingOfferRail({ editorial = false, offers, targetKey, targetTitle, status, context, onRetry, target, wardrobe, hero = false }: { hero?: boolean; editorial?: boolean; offers: ProductOffer[]; targetKey: string; targetTitle: string; status?: OfferStatus; context?: OfferContext; onRetry?: () => void; target?: ShoppingPriorityTarget; wardrobe?: ReadonlyMap<number, Item> }) {
  return <CuratedItemRail openDirect hero={hero} previewLimit={hero ? 8 : 3} editorial={editorial} offers={offers} status={status} heading="" browserTitle={targetTitle} reason={target?.rationale} target={target} wardrobe={wardrobe} context={context ?? { targetKey, surface: 'shopping_guide' }} onRetry={onRetry} />;
}
