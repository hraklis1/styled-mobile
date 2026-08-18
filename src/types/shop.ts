export type ShopOutfitItem = {
  name: string;
  category: string;
  brand: string;
  brandDomain?: string;
  priceRange: string;
  whyItFitsYou: string;
  imageQuery: string;
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
  source?: 'shopping_brief';
  shoppingBrief?: import('../lib/shoppingPriorityEdit').ShoppingPriorityEdit;
};
