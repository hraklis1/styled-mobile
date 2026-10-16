import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { TripDetailModal } from './TripDetailModal';
import { useTrips } from '../../hooks/useTrips';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { toDateStr } from '../calendar/calendarUtils';
import { daysUntilTrip, tripCountdown, tripProgressLabel, upcomingTrips } from '../../features/trips/presentation';
import { track } from '../../lib/analytics';
import { colors, radii, spacing, stroke } from '../../theme';

/** How far ahead a trip starts showing on Home: packing week. */
const LEAD_DAYS = 7;

/**
 * The next trip, once it's close enough to pack for and until it ends.
 * Opens the same Trip screen as Calendar and the chat card.
 */
export function HomeTripCard() {
  const today = toDateStr(new Date());
  const { data: trips = [] } = useTrips();
  const { openStylist } = useGlobalAIStylist();
  const [open, setOpen] = useState(false);
  const trip = upcomingTrips(trips, today).find((t) => (daysUntilTrip(t, today) ?? Infinity) <= LEAD_DAYS);
  if (!trip) return null;

  const live = trip.startDate <= today;
  const when = tripCountdown(trip, today);
  const progress = tripProgressLabel(trip);
  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => { track('trip_opened', { source: 'home_card' }); setOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel={`${live ? 'In' : 'Trip to'} ${trip.destination}, ${when}, ${progress}. Open trip`}
      >
        <Ionicons name={live ? 'briefcase-outline' : 'airplane-outline'} size={18} color={colors.accentInk} />
        <View style={styles.text}>
          <AppText variant="label" numberOfLines={1} style={styles.ink}>{live ? trip.destination : `${trip.destination} · ${when}`}</AppText>
          <AppText variant="meta" numberOfLines={1} style={styles.ink}>{live ? `${when} · ${progress}` : progress}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.accentInk} />
      </TouchableOpacity>
      <TripDetailModal
        tripId={open ? trip.id : null}
        onClose={() => setOpen(false)}
        onAsk={trip.conversationId != null ? (draft) => {
          const conversationId = trip.conversationId!;
          setOpen(false);
          // Let the trip modal finish dismissing; iOS won't present a second modal mid-dismissal.
          setTimeout(() => openStylist({ source: 'calendar_card', conversationId, draft }), 400);
        } : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radii.quickAction, backgroundColor: colors.accent, borderWidth: stroke.hairline, borderColor: 'rgba(111,89,72,0.18)' },
  text: { flex: 1, gap: 2 },
  ink: { color: colors.accentInk },
});
