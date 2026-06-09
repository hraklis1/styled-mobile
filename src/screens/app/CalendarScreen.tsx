import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import {
  useEvents,
  useDeleteEvent,
} from '../../hooks/useEvents';
import { useGenerateOutfit } from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { CalendarSyncSheet } from '../../components/calendar/CalendarSyncSheet';
import { WeekStrip } from '../../components/calendar/WeekStrip';
import { EventFormModal } from '../../components/calendar/EventFormModal';
import { EventDetailModal } from '../../components/calendar/EventDetailModal';
import { EventItemPickerModal } from '../../components/calendar/EventItemPickerModal';
import { ItemThumbStack } from '../../components/calendar/ItemThumbStack';
import {
  toDateStr,
  formatDayLabel,
  formatCountdown,
  formatTime,
  groupByDate,
  OCCASIONS,
  OCCASION_ICONS,
} from '../../components/calendar/calendarUtils';
import * as Location from 'expo-location';
import { colors, spacing, typography, radii } from '../../theme';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';

export function CalendarScreen({ navigation }: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: events = [], isLoading, refetch, isRefetching } = useEvents();
  const { data: allItems = [] } = useItems();
  const deleteEventMutation = useDeleteEvent();
  const generateOutfit = useGenerateOutfit();

  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => setDeviceCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }))
        .catch(() => { });
    }).catch(() => { });
  }, []);

  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [pickerEvent, setPickerEvent] = useState<Event | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);

  const UPCOMING_LIMIT = 4;
  const PAST_LIMIT = 5;

  const now = Date.now();

  const upcoming = useMemo(
    () => events
      .filter((e) => new Date(e.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );

  const past = useMemo(
    () => events
      .filter((e) => new Date(e.date).getTime() < now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );

  const weekDays = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const eventDateSet = useMemo(
    () => new Set(events.map((e) => toDateStr(new Date(e.date)))),
    [events],
  );

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);
  const groupedUpcoming = useMemo(() => groupByDate(visibleUpcoming), [visibleUpcoming]);
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT);

  const handleEdit = (ev: Event) => {
    setDetailEvent(null);
    setEditingEvent(ev);
    setFormVisible(true);
  };

  const handleDelete = (ev: Event) => {
    Alert.alert(
      'Delete Event',
      `Delete "${ev.title}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { deleteEventMutation.mutate(ev.id); setDetailEvent(null); },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Calendar</Text>
            <TouchableOpacity
              style={styles.syncIconBtn}
              onPress={() => setSyncVisible(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="sync-outline" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Plan ahead for every occasion.</Text>
        </View>

        {/* Week Strip */}
        <WeekStrip
          weekDays={weekDays}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrevWeek={() => setWeekOffset((o) => o - 1)}
          onNextWeek={() => setWeekOffset((o) => o + 1)}
          onToday={() => { setWeekOffset(0); setSelectedDate(toDateStr(new Date())); }}
          eventDateSet={eventDateSet}
          weekOffset={weekOffset}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="calendar-outline" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>
              Add upcoming events to plan the perfect outfit for each one.
            </Text>
          </View>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Upcoming{upcoming.length > UPCOMING_LIMIT
                    ? <Text style={styles.sectionCount}> ({upcoming.length})</Text>
                    : null}
                </Text>

                {groupedUpcoming.map(([dateStr, dayEvents]) => {
                  const dayDate = new Date(dateStr + 'T00:00:00');
                  const countdown = formatCountdown(dayDate);
                  return (
                    <View key={dateStr} style={styles.dayGroup}>
                      <View style={styles.dayHeader}>
                        <Text style={styles.dayLabel}>{formatDayLabel(dayDate)}</Text>
                        <View style={styles.dayDivider} />
                        {countdown ? <Text style={styles.dayCountdown}>{countdown}</Text> : null}
                      </View>

                      {dayEvents.map((event) => {
                        const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
                        return (
                          <TouchableOpacity
                            key={event.id}
                            style={styles.eventCard}
                            onPress={() => setDetailEvent(event)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.eventIconBox}>
                              <Ionicons name={iconName} size={18} color={colors.primary} />
                            </View>
                            <View style={styles.eventBody}>
                              <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                              <View style={styles.eventMeta}>
                                <Text style={styles.eventTime}>{formatTime(new Date(event.date))}</Text>
                                {event.location ? (
                                  <>
                                    <Text style={styles.dot}>·</Text>
                                    <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
                                    <Text style={styles.eventLoc} numberOfLines={1}>{event.location}</Text>
                                  </>
                                ) : null}
                              </View>
                              <View style={styles.occasionBadge}>
                                <Text style={styles.occasionBadgeText}>
                                  {OCCASIONS.find((o) => o.id === event.occasion)?.label ?? event.occasion}
                                </Text>
                              </View>
                            </View>
                            {(event.itemIds ?? []).length > 0
                              ? <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={() => setPickerEvent(event)} />
                              : <Ionicons name="chevron-forward" size={16} color={colors.border} />
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}

                {upcoming.length > UPCOMING_LIMIT && !showAllUpcoming && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllUpcoming(true)}>
                    <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                    <Text style={styles.showMoreText}>View all {upcoming.length} upcoming events</Text>
                  </TouchableOpacity>
                )}
                {showAllUpcoming && upcoming.length > UPCOMING_LIMIT && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllUpcoming(false)}>
                    <Text style={styles.showMoreText}>Show less</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Past */}
            {past.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Past</Text>
                {visiblePast.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.pastCard}
                    onPress={() => setDetailEvent(event)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pastIconBox}>
                      <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
                    </View>
                    <View style={styles.pastBody}>
                      <Text style={styles.pastTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.pastDate}>
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(event)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                {past.length > PAST_LIMIT && !showAllPast && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllPast(true)}>
                    <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                    <Text style={styles.showMoreText}>View {past.length - PAST_LIMIT} more past events</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + spacing.xl }]}
        onPress={() => { setEditingEvent(null); setFormVisible(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.fabText}>Add Event</Text>
      </TouchableOpacity>

      {/* Modals */}
      <EventDetailModal
        event={detailEvent}
        visible={detailEvent !== null}
        onClose={() => setDetailEvent(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAssign={(ev) => { setDetailEvent(null); setPickerEvent(ev); }}
        allItems={allItems}
        generateOutfit={generateOutfit}
        onViewOutfits={() => navigation.navigate('Closet')}
        deviceCoords={deviceCoords}
      />
      <EventFormModal
        visible={formVisible}
        event={editingEvent}
        onClose={() => { setFormVisible(false); setEditingEvent(null); }}
      />
      <EventItemPickerModal
        event={pickerEvent}
        visible={pickerEvent !== null}
        onClose={() => setPickerEvent(null)}
      />
      <CalendarSyncSheet
        visible={syncVisible}
        onClose={() => setSyncVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  header: { marginBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.foreground, letterSpacing: -0.5 },
  syncIconBtn: {
    width: 36, height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { fontSize: typography.size.sm, color: colors.mutedForeground, marginTop: 2 },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground, marginBottom: spacing.md },
  sectionCount: { fontWeight: typography.weight.regular, color: colors.mutedForeground },

  dayGroup: { marginBottom: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dayLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayDivider: { flex: 1, height: 1, backgroundColor: colors.border },
  dayCountdown: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  eventIconBox: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTime: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  dot: { fontSize: typography.size.xs, color: colors.mutedForeground },
  eventLoc: { fontSize: typography.size.xs, color: colors.mutedForeground, flex: 1 },
  occasionBadge: {
    alignSelf: 'flex-start', backgroundColor: `${colors.primary}15`,
    borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  occasionBadgeText: { fontSize: 10, fontWeight: typography.weight.semibold, color: colors.primary, textTransform: 'capitalize' },

  pastCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border, opacity: 0.7,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  pastIconBox: {
    width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  pastBody: { flex: 1, gap: 2 },
  pastTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  pastDate: { fontSize: typography.size.xs, color: colors.mutedForeground },

  showMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: spacing.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: spacing.xs,
  },
  showMoreText: { fontSize: typography.size.sm, color: colors.mutedForeground },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.md },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: radii.xl,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  emptySubtitle: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center', maxWidth: 260 },

  fab: {
    position: 'absolute', right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radii.xl, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },
});
