export type StoreFind = {
  id: string; // Using string UUID for client-side minted IDs
  imageUrl: string | null;
  imageUrls?: string[]; // multi-photo array; imageUrl mirrors imageUrls[0] for backward compat
  location: string | null;
  description: string | null;
  store: string | null;
  brand: string | null;
  price: number | null;
  size: string | null;
  notes: string | null;
  createdAt: string;
};
