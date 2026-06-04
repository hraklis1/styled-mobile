export type OutfitItemEntry = {
  id: number;
  category: string;
};

export type Outfit = {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  event: string | null;
  itemIds: OutfitItemEntry[];
  tags: string[];
  notes: string | null;
  isDraft: boolean;
  aiGeneratedImageUrl: string | null;
  wearCount: number;
  lastWornAt: string | null;
  createdAt: string;
};
