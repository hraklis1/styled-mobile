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

export type ShopOutfit = {
  intro: string;
  city: string;
  items: ShopOutfitItem[];
  totalBudget: string;
  audioSummary: string;
};
