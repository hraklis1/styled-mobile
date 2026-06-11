import type { Ionicons } from '@expo/vector-icons';

export type OccasionId = 'casual' | 'smart_casual' | 'business' | 'formal' | 'party' | 'workout';

export type Occasion = {
  id: OccasionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const OCCASIONS: Occasion[] = [
  { id: 'casual',       label: 'Casual',       icon: 'cafe-outline'          },
  { id: 'smart_casual', label: 'Smart Casual',  icon: 'wine-outline'          },
  { id: 'business',     label: 'Work',          icon: 'briefcase-outline'     },
  { id: 'formal',       label: 'Formal',        icon: 'star-outline'          },
  { id: 'party',        label: 'Night Out',      icon: 'musical-notes-outline' },
  { id: 'workout',      label: 'Active',         icon: 'bicycle-outline'       },
];

export const OCCASION_ICON_MAP: Record<OccasionId, keyof typeof Ionicons.glyphMap> = Object.fromEntries(
  OCCASIONS.map((o) => [o.id, o.icon]),
) as Record<OccasionId, keyof typeof Ionicons.glyphMap>;
