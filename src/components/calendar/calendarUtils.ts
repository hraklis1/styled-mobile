import { Ionicons } from '@expo/vector-icons';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDayLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCountdown(d: Date): string | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff <= 1) return null;
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return 'in 1 week';
  const weeks = Math.round(diff / 7);
  if (weeks < 5) return `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
  const months = Math.round(diff / 30);
  return `in ${months} month${months !== 1 ? 's' : ''}`;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function groupByDate<T extends { date: string }>(evs: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const ev of evs) {
    const key = toDateStr(new Date(ev.date));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries());
}

// ── Occasion data ─────────────────────────────────────────────────────────────

export const OCCASIONS = [
  { id: 'casual', label: 'Casual', icon: 'cafe-outline' as const },
  { id: 'smart_casual', label: 'Smart Casual', icon: 'shirt-outline' as const },
  { id: 'business', label: 'Professional', icon: 'briefcase-outline' as const },
  { id: 'formal', label: 'Formal', icon: 'star-outline' as const },
  { id: 'party', label: 'Night Out', icon: 'musical-notes-outline' as const },
  { id: 'workout', label: 'Active', icon: 'bicycle-outline' as const },
];

export const OCCASION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  casual: 'cafe-outline',
  smart_casual: 'shirt-outline',
  business: 'briefcase-outline',
  formal: 'star-outline',
  party: 'musical-notes-outline',
  workout: 'bicycle-outline',
};

export const ENVS = ['Indoor', 'Outdoor', 'Mixed'] as const;
