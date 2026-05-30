export type ShopOutfitItem = {
  name: string;
  category: string;
  brand: string;
  brandDomain?: string;
  priceRange: string;
  whyItFitsYou: string;
  imageQuery: string;
};

export type ShopOutfit = {
  intro: string;
  city: string;
  items: ShopOutfitItem[];
  totalBudget: string;
  audioSummary: string;
};
