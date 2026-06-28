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
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEvents,
  useDeleteEvent,
  EVENTS_QUERY_KEY,
} from '../../hooks/useEvents';
import {
  useAcceptEventOutfitPlan,
  useGenerateEventOutfitPlan,
  type GenerateOutfitResult,
} from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { CalendarSyncSheet } from '../../components/calendar/CalendarSyncSheet';
import { WeekStrip } from '../../components/calendar/WeekStrip';
import { EventFormModal } from '../../components/calendar/EventFormModal';
import { EventDetailModal } from '../../components/calendar/EventDetailModal';
import { EventItemPickerModal } from '../../components/calendar/EventItemPickerModal';
import { EventOutfitPickerModal } from '../../components/calendar/EventOutfitPickerModal';
import { ItemThumbStack } from '../../components/calendar/ItemThumbStack';
import { NextEventHero } from '../../components/calendar/NextEventHero';
import { OutfitGeneratedSheet } from '../../components/calendar/OutfitGeneratedSheet';
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
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radii } from '../../theme';
import { ErrorState } from '../../components/primitives/ErrorState';
import { ScreenHeader } from '../../components/primitives/Editorial';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { useGlobalAIStylist, type StylistOpenSource } from '../../contexts/GlobalAIStylistContext';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';

const FREE_EVENT_LIMIT = 5;

export function CalendarScreen({ navigation }: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const { openStylist } = useGlobalAIStylist();
  const { data: events = [], isLoading, refetch, isRefetching, isError } = useEvents();
  const { data: allItems = [] } = useItems();
  const deleteEventMutation = useDeleteEvent();
  const generatePlan = useGenerateEventOutfitPlan();
  const acceptPlan = useAcceptEventOutfitPlan();
  const queryClient = useQueryClient();
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => setDeviceCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }))
        .catch(() => { });
    }).catch(() => { });
  }, []);

  // null = no day filter; a date string filters the list to that day
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [pickerEvent, setPickerEvent] = useState<Event | null>(null);
  const [outfitPickerEvent, setOutfitPickerEvent] = useState<Event | null>(null);
  const [returnToDetailEventId, setReturnToDetailEventId] = useState<number | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [plannedEvent, setPlannedEvent] = useState<Event | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GenerateOutfitResult | null>(null);

  const UPCOMING_LIMIT = 4;
  const PAST_LIMIT = 5;

  // Events stay in "Upcoming" until their day ends, not the minute they start
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayStartMs = startOfToday.getTime();

  const upcoming = useMemo(
    () => events
      .filter((e) => new Date(e.date).getTime() >= dayStartMs)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );

  const past = useMemo(
    () => events
      .filter((e) => new Date(e.date).getTime() < dayStartMs)
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

  // Events on the selected day (day-filter mode), in chronological order
  const dayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events
      .filter((e) => toDateStr(new Date(e.date)) === selectedDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, selectedDate]);

  const formInitialDate = useMemo(
    () => (selectedDate ? new Date(selectedDate + 'T09:00:00') : null),
    [selectedDate],
  );

  const nextEvent = upcoming[0] ?? null;
  const upcomingRest = upcoming.slice(1);
  const visibleUpcoming = showAllUpcoming ? upcomingRest : upcomingRest.slice(0, UPCOMING_LIMIT);
  const groupedUpcoming = useMemo(() => groupByDate(visibleUpcoming), [visibleUpcoming]);
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT);

  const handleAddEvent = async () => {
    if (!isPremium && events.length >= FREE_EVENT_LIMIT) {
      await presentPaywall();
      return;
    }
    setEditingEvent(null);
    setReturnToDetailEventId(null);
    setFormVisible(true);
  };

  const handleEdit = (ev: Event) => {
    setReturnToDetailEventId(ev.id);
    setDetailEvent(null);
    setEditingEvent(ev);
    setFormVisible(true);
  };

  const openItemPicker = (ev: Event, returnToDetail = false) => {
    setReturnToDetailEventId(returnToDetail ? ev.id : null);
    if (returnToDetail) setDetailEvent(null);
    setPickerEvent(ev);
  };

  const openOutfitPicker = (ev: Event, returnToDetail = false) => {
    setReturnToDetailEventId(returnToDetail ? ev.id : null);
    if (returnToDetail) setDetailEvent(null);
    setOutfitPickerEvent(ev);
  };

  const restoreDetailAfterChildClose = (eventId: number | null) => {
    if (eventId === null) return;
    setTimeout(() => {
      const event = eventsRef.current.find((candidate) => candidate.id === eventId);
      if (event) setDetailEvent(event);
    }, 300);
  };

  const closeEventForm = () => {
    const eventId = returnToDetailEventId;
    setFormVisible(false);
    setEditingEvent(null);
    setReturnToDetailEventId(null);
    restoreDetailAfterChildClose(eventId);
  };

  const closeItemPicker = () => {
    const eventId = returnToDetailEventId;
    setPickerEvent(null);
    setReturnToDetailEventId(null);
    restoreDetailAfterChildClose(eventId);
  };

  const closeOutfitPicker = () => {
    const eventId = returnToDetailEventId;
    setOutfitPickerEvent(null);
    setReturnToDetailEventId(null);
    restoreDetailAfterChildClose(eventId);
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

  const openStylistForEvent = (event: Event, source: StylistOpenSource) => {
    const details = [
      `Dress me for "${event.title}"`,
      `on ${new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      event.occasion ? `for a ${event.occasion.replaceAll('_', ' ')} occasion` : null,
      event.location ? `at ${event.location}` : null,
      event.environment ? `in a ${event.environment} setting` : null,
    ].filter(Boolean).join(' ');
    // Let the detail modal finish dismissing before presenting the stylist sheet
    const delay = detailEvent ? 300 : 0;
    setDetailEvent(null);
    setTimeout(() => {
      openStylist({
        initialQuery: `${details}.`,
        destination: event.location ?? undefined,
        source,
        eventContext: { id: event.id, title: event.title },
        context: {
          kind: 'event',
          eventId: event.id,
          title: event.title,
          date: event.date,
          location: event.location,
          occasion: event.occasion,
          environment: event.environment,
          itemIds: event.itemIds ?? undefined,
        },
      });
    }, delay);
  };

  const planOutfitForEvent = async (event: Event, previousCandidateId?: string) => {
    if (!isPremium) {
      const shouldUpgrade = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Unlock outfit planning',
          'Get personalized event outfits built from your wardrobe, style, and the forecast.',
          [
            { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
            { text: 'See plans', onPress: () => resolve(true) },
          ],
        );
      });
      if (shouldUpgrade) await presentPaywall();
      return;
    }
    // When planning from the open detail modal, dismiss it first so the result
    // sheet isn't presented behind the pageSheet — and remember to restore it.
    // (Skip on "Try another", where the sheet is already the active modal.)
    const fromDetail = !previousCandidateId && detailEvent?.id === event.id;
    if (fromDetail) {
      setReturnToDetailEventId(event.id);
      setDetailEvent(null);
    }
    setPlannedEvent(event);
    generatePlan.mutate(
      {
        eventId: event.id,
        ...(deviceCoords ?? {}),
        ...(previousCandidateId ? { previousCandidateId } : {}),
      },
      {
        onSuccess: (result) => {
          const showSheet = () => {
            setGeneratedPlan(result);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          };
          // Let the detail dismissal animation finish before mounting the sheet;
          // iOS rejects presenting a modal while another is still dismissing.
          if (fromDetail) setTimeout(showSheet, 300);
          else showSheet();
        },
        onError: (err: any) => {
          Alert.alert(
            'Could not plan outfit',
            err?.response?.data?.message ?? 'Please try again.',
          );
          if (fromDetail) {
            setReturnToDetailEventId(null);
            restoreDetailAfterChildClose(event.id);
          }
        },
      },
    );
  };

  const acceptGeneratedPlan = () => {
    if (!plannedEvent || !generatedPlan) return;
    const eventId = plannedEvent.id;
    const restoreId = returnToDetailEventId;
    acceptPlan.mutate(
      { eventId, candidateId: generatedPlan.candidateId },
      {
        onSuccess: ({ itemIds }) => {
          // Optimistically apply the new outfit so the list and the restored
          // detail modal show the assigned items immediately (no empty-state flash
          // before the query invalidation refetch lands).
          queryClient.setQueryData<Event[]>(EVENTS_QUERY_KEY, (old) =>
            old?.map((e) => (e.id === eventId ? { ...e, itemIds } : e)) ?? old,
          );
          setGeneratedPlan(null);
          setPlannedEvent(null);
          setReturnToDetailEventId(null);
          restoreDetailAfterChildClose(restoreId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        },
        onError: (err: any) => {
          Alert.alert('Could not save outfit', err?.response?.data?.message ?? 'Please try again.');
        },
      },
    );
  };

  const handleSelectDate = (s: string) => {
    setSelectedDate((prev) => (prev === s ? null : s));
  };

  const renderEventCard = (event: Event) => {
    const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => setDetailEvent(event)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={event.title}
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
        {(event.itemIds ?? []).length > 0 ? (
          <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={() => openItemPicker(event)} />
        ) : null}
        <Ionicons name="chevron-forward" size={14} color={colors.border} />
      </TouchableOpacity>
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
        <ScreenHeader
          title="Calendar"
          subtitle="Plan ahead for every occasion."
          safeTop={false}
          style={styles.header}
          primaryAction={{ label: 'Add event', icon: 'add', onPress: handleAddEvent }}
          secondaryActions={[{ label: 'Sync calendar', icon: 'sync-outline', onPress: () => setSyncVisible(true) }]}
        />

        {/* Week Strip */}
        <WeekStrip
          weekDays={weekDays}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          onPrevWeek={() => setWeekOffset((o) => o - 1)}
          onNextWeek={() => setWeekOffset((o) => o + 1)}
          onToday={() => { setWeekOffset(0); setSelectedDate(null); }}
          eventDateSet={eventDateSet}
          weekOffset={weekOffset}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
        ) : isError ? (
          <ErrorState message="Couldn't load events" onRetry={refetch} />
        ) : selectedDate ? (
          /* Day-filter mode: tapped a day in the strip */
          <View style={styles.section}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>
                {formatDayLabel(new Date(selectedDate + 'T00:00:00'))}
              </Text>
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => setSelectedDate(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Show all events"
              >
                <Ionicons name="close" size={12} color={colors.mutedForeground} />
                <Text style={styles.clearFilterText}>Show all</Text>
              </TouchableOpacity>
            </View>
            {dayEvents.length === 0 ? (
              <View style={styles.dayEmpty}>
                <Text style={styles.dayEmptyText}>Nothing planned for this day.</Text>
                <TouchableOpacity
                  style={styles.dayEmptyBtn}
                  onPress={handleAddEvent}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Add event on this day"
                >
                  <Ionicons name="add" size={14} color={colors.primary} />
                  <Text style={styles.dayEmptyBtnText}>Add event</Text>
                </TouchableOpacity>
              </View>
            ) : (
              dayEvents.map(renderEventCard)
            )}
          </View>
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="calendar-outline" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>
              Add upcoming events to plan the perfect outfit for each one.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={handleAddEvent}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add your first event"
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.emptyBtnText}>Add your first event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Next event hero */}
            {nextEvent && (
              <NextEventHero
                event={nextEvent}
                allItems={allItems}
                deviceCoords={deviceCoords}
                isPremium={isPremium}
                onPress={() => setDetailEvent(nextEvent)}
                onPlanOutfit={() => planOutfitForEvent(nextEvent)}
                onPressOutfit={() => openItemPicker(nextEvent)}
              />
            )}

            {/* Upcoming (after the hero) */}
            {upcomingRest.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Later{upcomingRest.length > UPCOMING_LIMIT
                    ? <Text style={styles.sectionCount}> ({upcomingRest.length})</Text>
                    : null}
                </Text>

                {groupedUpcoming.map(([dateStr, group]) => {
                  const dayDate = new Date(dateStr + 'T00:00:00');
                  const countdown = formatCountdown(dayDate);
                  return (
                    <View key={dateStr} style={styles.dayGroup}>
                      <View style={styles.dayHeader}>
                        <Text style={styles.dayLabel}>{formatDayLabel(dayDate)}</Text>
                        <View style={styles.dayDivider} />
                        {countdown ? <Text style={styles.dayCountdown}>{countdown}</Text> : null}
                      </View>

                      {group.map(renderEventCard)}
                    </View>
                  );
                })}

                {upcomingRest.length > UPCOMING_LIMIT && !showAllUpcoming && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllUpcoming(true)}>
                    <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                    <Text style={styles.showMoreText}>View all {upcomingRest.length} upcoming events</Text>
                  </TouchableOpacity>
                )}
                {showAllUpcoming && upcomingRest.length > UPCOMING_LIMIT && (
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
                    accessibilityRole="button"
                    accessibilityLabel={event.title}
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
                    <TouchableOpacity onPress={() => handleDelete(event)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Delete ${event.title}`}>
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

      {/* Modals */}
      <EventDetailModal
        event={detailEvent}
        visible={detailEvent !== null}
        onClose={() => setDetailEvent(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAssign={(ev) => openItemPicker(ev, true)}
        onChooseOutfit={(ev) => openOutfitPicker(ev, true)}
        allItems={allItems}
        onPlanOutfit={planOutfitForEvent}
        isPlanning={generatePlan.isPending && plannedEvent?.id === detailEvent?.id}
        onOpenStylist={(event) => openStylistForEvent(event, 'event_detail')}
        deviceCoords={deviceCoords}
        isPremium={isPremium}
      />
      <EventFormModal
        visible={formVisible}
        event={editingEvent}
        initialDate={formInitialDate}
        onClose={closeEventForm}
      />
      <EventItemPickerModal
        event={pickerEvent}
        visible={pickerEvent !== null}
        onClose={closeItemPicker}
      />
      <EventOutfitPickerModal
        event={outfitPickerEvent}
        visible={outfitPickerEvent !== null}
        onClose={closeOutfitPicker}
      />
      <CalendarSyncSheet
        visible={syncVisible}
        onClose={() => setSyncVisible(false)}
      />
      <OutfitGeneratedSheet
        result={generatedPlan}
        allItems={allItems}
        onDone={() => {
          const restoreId = returnToDetailEventId;
          setGeneratedPlan(null);
          setPlannedEvent(null);
          setReturnToDetailEventId(null);
          restoreDetailAfterChildClose(restoreId);
        }}
        onAccept={acceptGeneratedPlan}
        onTryAnother={() => {
          if (plannedEvent && generatedPlan) {
            planOutfitForEvent(plannedEvent, generatedPlan.candidateId);
          }
        }}
        isAccepting={acceptPlan.isPending}
        isRegenerating={generatePlan.isPending}
        hasCurrentOutfit={(plannedEvent?.itemIds ?? []).length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  header: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.foreground, letterSpacing: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerIconBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  addIconBtn: {
    width: 44, height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { fontSize: typography.size.sm, color: colors.mutedForeground, marginTop: 2 },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground, marginBottom: spacing.md },
  sectionCount: { fontWeight: typography.weight.regular, color: colors.mutedForeground },

  filterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  filterTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  clearFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 5,
    borderRadius: radii.full, backgroundColor: colors.muted,
  },
  clearFilterText: { fontSize: 11, fontWeight: typography.weight.medium, color: colors.mutedForeground },

  dayEmpty: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radii.lg,
  },
  dayEmptyText: { fontSize: typography.size.sm, color: colors.mutedForeground },
  dayEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full, backgroundColor: `${colors.primary}12`,
  },
  dayEmptyBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },

  dayGroup: { marginBottom: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dayLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayDivider: { flex: 1, height: 1, backgroundColor: colors.border },
  dayCountdown: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: 64,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.sm,
  },
  eventIconBox: {
    width: 36, height: 36, borderRadius: radii.md,
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
    alignSelf: 'flex-start', marginTop: 2,
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
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  emptyBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },

});
