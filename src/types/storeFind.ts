export type StoreFind = {
  id: string; // Using string UUID for client-side minted IDs
  imageUrl: string | null;
  location: string | null;
  description: string | null;
  store: string | null;
  brand: string | null;
  price: number | null;
  size: string | null;
  notes: string | null;
  interestLevel: number | null; // e.g. 1-5
  createdAt: string;
};
