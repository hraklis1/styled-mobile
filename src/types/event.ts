export type Event = {
  id: number;
  userId: number;
  title: string;
  date: string;            // ISO timestamp string from backend
  occasion: string;        // not nullable in schema
  location: string | null;
  notes: string | null;
  environment: string | null;
  itemIds: number[] | null;
  outfitId: number | null;
};
