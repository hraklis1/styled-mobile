import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { parseLocalCalendarDate } from '../../features/stylist/workflows';
import type { TripSummary } from '../../features/trips/types';
import { colors, radii, spacing, stroke } from '../../theme';

/** Which trip, if any, covers a calendar date. Trips are listed soonest first. */
export function tripOnDate(trips: TripSummary[], date: string): TripSummary | undefined {
  return trips.find((trip) => trip.startDate <= date && date <= trip.endDate);
}

function dayNumber(trip: TripSummary, date: string): { day: number; of: number } | null {
  const start = parseLocalCalendarDate(trip.startDate), end = parseLocalCalendarDate(trip.endDate), at = parseLocalCalendarDate(date);
  if (!start || !end || !at) return null;
  return { day: Math.round((at.getTime() - start.getTime()) / 86_400_000) + 1, of: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 };
}

/**
 * A slim band under a day heading while a planned trip is on. The first day
 * carries packing progress, since that's the morning it matters.
 */
export function TripDayBand({ trip, date, onPress }: { trip: TripSummary; date: string; onPress: () => void }) {
  const n = dayNumber(trip, date);
  const first = date === trip.startDate;
  const detail = first && trip.packable > 0
    ? (trip.packed >= trip.packable ? 'All packed' : `${trip.packed} of ${trip.packable} packed`)
    : n ? `Day ${n.day} of ${n.of}` : '';
  return (
    <TouchableOpacity style={styles.band} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Trip to ${trip.destination}${detail ? `, ${detail}` : ''}. Open trip`}>
      <Ionicons name={first ? 'airplane-outline' : 'briefcase-outline'} size={14} color={colors.accentInk} />
      <View style={styles.text}>
        <AppText variant="label" numberOfLines={1} style={styles.ink}>{first ? `Leaving for ${trip.destination}` : trip.destination}</AppText>
        {detail ? <AppText variant="meta" style={styles.ink}>{detail}</AppText> : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.accentInk} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.accent, borderWidth: stroke.hairline, borderColor: 'rgba(111,89,72,0.18)' },
  text: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  ink: { color: colors.accentInk },
});
