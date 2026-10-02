export type ShopOutfitItem = {
  name: string;
  category: string;
  brand: string;
  brandDomain?: string;
  priceRange: string;
  whyItFitsYou: string;
  imageQuery: string;
  key?: string;
  offers?: import('./commerce').ProductOffer[];
  offerState?: import('./commerce').OfferResult;
  /** Product/editorial image returned by the shopping provider when available. */
  imageUrl?: string;
  /** Direct product or retailer result. Falls back to a shopping search when absent. */
  retailerUrl?: string;
};

export type ShopRecommendationType = 'look' | 'piece' | 'list';

export type ShopOutfit = {
  /** Server-assigned semantic type: coordinated look, single piece, or shopping list. */
  recommendationType?: ShopRecommendationType;
  intro: string;
  city: string;
  items: ShopOutfitItem[];
  totalBudget: string;
  audioSummary: string;
  /** Saved editorial Shopping Brief edit; kept in the existing wishlist payload. */
  source?: 'shopping_brief' | 'product';
  commerceReference?: string;
  commerceConversationId?: number;
  commerceContext?: { currency: string; country?: string | null; hardPriceMax?: number };
  product?: { offer: import('./commerce').ProductOffer; savedPriceAt: string; source: string; target: { key: string; category: string; title: string; color: string; material: string; silhouette: string; priceRange: string; retailerExamples: string[] } };
  shoppingBrief?: import('../lib/shoppingPriorityEdit').ShoppingPriorityEdit;
};
