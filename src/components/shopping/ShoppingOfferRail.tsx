import { CuratedItemRail } from './CuratedItemRail';
import type { OfferContext, OfferStatus, ProductOffer } from '../../types/commerce';
export function ShoppingOfferRail({ offers, targetKey, targetTitle, status, context, onRetry }: { offers: ProductOffer[]; targetKey: string; targetTitle: string; status?: OfferStatus; context?: OfferContext; onRetry?: () => void }) {
  return <CuratedItemRail offers={offers} status={status} heading="" browserTitle={targetTitle} context={context ?? { targetKey, surface: 'shopping_guide' }} onRetry={onRetry} />;
}
