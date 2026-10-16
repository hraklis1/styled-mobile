import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { tripCountdown, tripProgressLabel } from '../../features/trips/presentation';
import type { TripSummary } from '../../features/trips/types';
import { colors, radii, spacing, stroke } from '../../theme';

/**
 * Calendar's shelf of trips: what's coming up, a way to plan another, and
 * the archive. Trips are date ranges, so this is where they're found again
 * after the chat that made them has scrolled away.
 */
export function UpcomingTripsRow({ trips, pastCount, today, onOpen, onPlan, onPast }: {
  trips: TripSummary[];
  pastCount: number;
  today: string;
  onOpen: (trip: TripSummary) => void;
  onPlan: () => void;
  onPast: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {trips.map((trip) => {
        const when = tripCountdown(trip, today);
        const progress = tripProgressLabel(trip);
        const live = trip.startDate <= today;
        return (
          <TouchableOpacity
            key={trip.id}
            style={[styles.card, live && styles.cardLive]}
            onPress={() => onOpen(trip)}
            accessibilityRole="button"
            accessibilityLabel={`Trip to ${trip.destination}, ${when}, ${progress}. Open trip`}
          >
            <Ionicons name={live ? 'briefcase-outline' : 'airplane-outline'} size={14} color={colors.accentInk} />
            <View>
              <AppText variant="label" numberOfLines={1} style={styles.ink}>{trip.destination}</AppText>
              <AppText variant="meta" numberOfLines={1} style={styles.ink}>{when} · {progress}</AppText>
            </View>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.chip} onPress={onPlan} accessibilityRole="button" accessibilityLabel="Plan a trip">
        <Ionicons name="add" size={14} color={colors.primary} />
        <AppText variant="label" style={styles.chipText}>Plan a trip</AppText>
      </TouchableOpacity>
      {pastCount > 0 ? (
        <TouchableOpacity style={styles.chip} onPress={onPast} accessibilityRole="button" accessibilityLabel={`Past trips, ${pastCount}`}>
          <AppText variant="label" style={styles.chipText}>Past trips</AppText>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.page },
  row: { gap: spacing.sm, paddingHorizontal: spacing.page, paddingVertical: spacing.sm, alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 240, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.accent, borderWidth: stroke.hairline, borderColor: 'rgba(111,89,72,0.18)' },
  cardLive: { borderColor: colors.accentInk },
  ink: { color: colors.accentInk },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.action, borderWidth: stroke.hairline, borderColor: colors.border },
  chipText: { color: colors.primary },
});
