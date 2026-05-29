export type Outfit = {
  id: number;
  name: string;
  userId: number;
  event: string | null;
  topId: number | null;
  bottomId: number | null;
  shoesId: number | null;
  outerwearId: number | null;
  accessoryId: number | null;
  tags: string[];
  notes: string | null;
  isDraft: boolean;
  aiGeneratedImageUrl: string | null;
  wearCount: number;
  lastWornAt: string | null;
  createdAt: string;
};
