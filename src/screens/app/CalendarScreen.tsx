import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { presentPaywall } from '../../lib/paywall';
import { useGlobalAIStylist, type StylistOpenSource } from '../../contexts/GlobalAIStylistContext';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';
import { presentCalendarEvent } from '../../components/calendar/calendar-presentation';

const FREE_EVENT_LIMIT = 5;

type CalendarTimelineItem =
  | { kind: 'loading'; key: string }
  | { kind: 'error'; key: string }
  | { kind: 'empty'; key: string }
  | { kind: 'selected-heading'; key: string; label: string }
  | { kind: 'selected-empty'; key: string }
  | { kind: 'hero'; key: string; event: Event }
  | { kind: 'section-heading'; key: string; label: string; count?: number; muted?: boolean }
  | { kind: 'day-heading'; key: string; dateStr: string }
  | { kind: 'event'; key: string; event: Event }
  | { kind: 'show-upcoming'; key: string; expanded: boolean; count: number }
  | { kind: 'past-toggle'; key: string; expanded: boolean; count: number }
  | { kind: 'past-event'; key: string; event: Event };

function CalendarLoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap} accessibilityLabel="Loading calendar events">
      <View style={styles.skeletonHero}>
        <View style={[styles.skeletonLine, { width: 72 }]} />
        <View style={styles.skeletonHeroMain}>
          <View style={styles.skeletonDate} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={[styles.skeletonLine, { width: '78%', height: 16 }]} />
            <View style={[styles.skeletonLine, { width: '52%' }]} />
          </View>
        </View>
        <View style={[styles.skeletonLine, { width: '100%', height: 42 }]} />
      </View>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonIcon} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={[styles.skeletonLine, { width: `${72 - index * 8}%`, height: 13 }]} />
            <View style={[styles.skeletonLine, { width: '52%' }]} />
          </View>
          <View style={[styles.skeletonLine, { width: 60, height: 24 }]} />
        </View>
      ))}
    </View>
  );
}

export function CalendarScreen({ navigation }: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const { activeLocation } = useActiveStylingLocation();
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
  const [pastExpanded, setPastExpanded] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [plannedEvent, setPlannedEvent] = useState<Event | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GenerateOutfitResult | null>(null);

  const UPCOMING_LIMIT = 4;

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

  const timelineItems = useMemo<CalendarTimelineItem[]>(() => {
    if (isLoading) return [{ kind: 'loading', key: 'loading' }];
    if (isError) return [{ kind: 'error', key: 'error' }];

    if (selectedDate) {
      const selected: CalendarTimelineItem[] = [{
        kind: 'selected-heading',
        key: `selected-${selectedDate}`,
        label: formatDayLabel(new Date(`${selectedDate}T00:00:00`)),
      }];
      if (dayEvents.length === 0) selected.push({ kind: 'selected-empty', key: 'selected-empty' });
      else dayEvents.forEach((event) => selected.push({ kind: 'event', key: `event-${event.id}`, event }));
      return selected;
    }

    if (events.length === 0) return [{ kind: 'empty', key: 'empty' }];

    const items: CalendarTimelineItem[] = [];
    if (nextEvent) items.push({ kind: 'hero', key: `hero-${nextEvent.id}`, event: nextEvent });

    if (upcomingRest.length > 0) {
      items.push({
        kind: 'section-heading',
        key: 'later-heading',
        label: 'Later',
        count: upcomingRest.length > UPCOMING_LIMIT ? upcomingRest.length : undefined,
      });
      groupedUpcoming.forEach(([dateStr, group]) => {
        items.push({ kind: 'day-heading', key: `day-${dateStr}`, dateStr });
        group.forEach((event) => items.push({ kind: 'event', key: `event-${event.id}`, event }));
      });
      if (upcomingRest.length > UPCOMING_LIMIT) {
        items.push({
          kind: 'show-upcoming',
          key: 'show-upcoming',
          expanded: showAllUpcoming,
          count: upcomingRest.length,
        });
      }
    }

    if (past.length > 0) {
      items.push({
        kind: 'past-toggle',
        key: 'past-toggle',
        expanded: pastExpanded,
        count: past.length,
      });
      if (pastExpanded) {
        past.forEach((event) => items.push({ kind: 'past-event', key: `past-${event.id}`, event }));
      }
    }

    return items;
  }, [
    UPCOMING_LIMIT,
    dayEvents,
    events.length,
    groupedUpcoming,
    isError,
    isLoading,
    nextEvent,
    past,
    pastExpanded,
    selectedDate,
    showAllUpcoming,
    upcomingRest.length,
  ]);

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
    // Keep event details visible while the plan is generated so the user sees
    // the in-sheet progress state. Dismiss only once the result is ready, then
    // present the result sheet after the page-sheet transition completes.
    const fromDetail = !previousCandidateId && detailEvent?.id === event.id;
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
          if (fromDetail) {
            setReturnToDetailEventId(event.id);
            setDetailEvent(null);
            // iOS rejects presenting a modal while another is still dismissing.
            setTimeout(showSheet, 300);
          } else {
            showSheet();
          }
        },
        onError: (err: any) => {
          Alert.alert(
            'Could not plan outfit',
            err?.response?.data?.message ?? 'Please try again.',
          );
          if (!previousCandidateId) setPlannedEvent(null);
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
    const occasion = OCCASIONS.find((option) => option.id === event.occasion)?.label ?? event.occasion;
    const presentation = presentCalendarEvent(event);
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => setDetailEvent(event)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${presentation.readinessLabel}`}
      >
        <View style={styles.eventIconBox}>
          <Ionicons name={iconName} size={18} color={colors.primary} />
        </View>
        <View style={styles.eventBody}>
          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
          <View style={styles.eventMeta}>
            <Text style={styles.eventTime}>{formatTime(new Date(event.date))}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.eventOccasion} numberOfLines={1}>{occasion}</Text>
            {event.location ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.eventLoc} numberOfLines={1}>{event.location}</Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.eventReadiness}>
          {presentation.hasOutfit ? (
            <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={() => openItemPicker(event)} />
          ) : (
            <View style={styles.needsOutfitIcon}>
              <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
            </View>
          )}
          <Text style={[styles.readinessText, presentation.hasOutfit && styles.readinessTextPlanned]}>
            {presentation.readinessShortLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTimelineItem = ({ item }: { item: CalendarTimelineItem }) => {
    switch (item.kind) {
      case 'loading':
        return <CalendarLoadingSkeleton />;
      case 'error':
        return <ErrorState message="Couldn't load events" onRetry={refetch} />;
      case 'empty':
        return (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="calendar-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your style calendar starts here</Text>
            <Text style={styles.emptySubtitle}>
              Add an occasion and Styled will help you prepare the look.
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
        );
      case 'selected-heading':
        return (
          <View style={styles.filterHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Selected day</Text>
              <Text style={styles.filterTitle}>{item.label}</Text>
            </View>
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => setSelectedDate(null)}
              accessibilityRole="button"
              accessibilityLabel="Show all events"
            >
              <Ionicons name="close" size={12} color={colors.mutedForeground} />
              <Text style={styles.clearFilterText}>Show all</Text>
            </TouchableOpacity>
          </View>
        );
      case 'selected-empty':
        return (
          <View style={styles.dayEmpty}>
            <View style={styles.dayEmptyIcon}>
              <Ionicons name="sunny-outline" size={19} color={colors.primary} />
            </View>
            <Text style={styles.dayEmptyTitle}>Nothing planned</Text>
            <Text style={styles.dayEmptyText}>Keep the day open or add an occasion.</Text>
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
        );
      case 'hero':
        return (
          <NextEventHero
            event={item.event}
            allItems={allItems}
            weatherFallback={activeLocation}
            isPremium={isPremium}
            onPress={() => setDetailEvent(item.event)}
            onPlanOutfit={() => planOutfitForEvent(item.event)}
            onPressOutfit={() => openItemPicker(item.event)}
            isPlanning={generatePlan.isPending && plannedEvent?.id === item.event.id}
          />
        );
      case 'section-heading':
        return (
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, item.muted && styles.sectionTitleMuted]}>{item.label}</Text>
            {item.count ? <Text style={styles.sectionCount}>{item.count}</Text> : null}
          </View>
        );
      case 'day-heading': {
        const dayDate = new Date(`${item.dateStr}T00:00:00`);
        const countdown = formatCountdown(dayDate);
        return (
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>{formatDayLabel(dayDate)}</Text>
            <View style={styles.dayDivider} />
            {countdown ? <Text style={styles.dayCountdown}>{countdown}</Text> : null}
          </View>
        );
      }
      case 'event':
        return renderEventCard(item.event);
      case 'show-upcoming':
        return (
          <TouchableOpacity
            style={styles.showMore}
            onPress={() => setShowAllUpcoming(!item.expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: item.expanded }}
          >
            <Text style={styles.showMoreText}>
              {item.expanded ? 'Show fewer events' : `View all ${item.count} upcoming events`}
            </Text>
            <Ionicons name={item.expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        );
      case 'past-toggle':
        return (
          <TouchableOpacity
            style={styles.pastToggle}
            onPress={() => setPastExpanded(!item.expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: item.expanded }}
            accessibilityLabel={`${item.expanded ? 'Collapse' : 'Expand'} ${item.count} past events`}
          >
            <View>
              <Text style={styles.pastToggleTitle}>Past</Text>
              <Text style={styles.pastToggleMeta}>{item.count} previous {item.count === 1 ? 'event' : 'events'}</Text>
            </View>
            <Ionicons name={item.expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        );
      case 'past-event':
        return (
          <TouchableOpacity
            style={styles.pastCard}
            onPress={() => setDetailEvent(item.event)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={item.event.title}
          >
            <View style={styles.pastDateBlock}>
              <Text style={styles.pastMonth}>{presentCalendarEvent(item.event).monthLabel}</Text>
              <Text style={styles.pastDay}>{presentCalendarEvent(item.event).dayLabel}</Text>
            </View>
            <View style={styles.pastBody}>
              <Text style={styles.pastTitle} numberOfLines={1}>{item.event.title}</Text>
              <Text style={styles.pastDate} numberOfLines={1}>
                {new Date(item.event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={styles.root}>
      <FlashList
        data={timelineItems}
        renderItem={renderTimelineItem}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl * 2 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        ListHeaderComponent={(
          <View>
            <ScreenHeader
              title="Calendar"
              subtitle="Plan ahead for every occasion."
              safeTop={false}
              style={styles.header}
              primaryAction={{ label: 'Add event', icon: 'add', onPress: handleAddEvent }}
              secondaryActions={[{
                label: 'Calendars',
                accessibilityLabel: 'Calendars and syncing',
                icon: 'calendar-outline',
                variant: 'ghost',
                onPress: () => setSyncVisible(true),
              }]}
            />
            <WeekStrip
              weekDays={weekDays}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onPrevWeek={() => setWeekOffset((offset) => offset - 1)}
              onNextWeek={() => setWeekOffset((offset) => offset + 1)}
              onToday={() => { setWeekOffset(0); setSelectedDate(null); }}
              eventDateSet={eventDateSet}
              weekOffset={weekOffset}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      />

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
        weatherFallback={activeLocation}
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
  scrollContent: { paddingHorizontal: spacing.lg },

  header: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  sectionTitleMuted: { color: colors.mutedForeground },
  sectionCount: {
    minWidth: 24,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  filterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  clearFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full, backgroundColor: colors.muted,
  },
  clearFilterText: { fontSize: 11, fontWeight: typography.weight.medium, color: colors.mutedForeground },

  dayEmpty: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radii.xl,
  },
  dayEmptyIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  dayEmptyTitle: { fontSize: typography.size.md, color: colors.foreground, fontWeight: typography.weight.semibold },
  dayEmptyText: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center' },
  dayEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full, backgroundColor: colors.surfaceSelected,
  },
  dayEmptyBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },

  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  dayLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayDivider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dayCountdown: { fontSize: 11, fontWeight: typography.weight.medium, color: colors.primary },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  eventIconBox: {
    width: 38, height: 38, borderRadius: radii.lg,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
    borderCurve: 'continuous',
  },
  eventBody: { flex: 1, minWidth: 0, gap: 4 },
  eventTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  eventTime: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  dot: { fontSize: typography.size.xs, color: colors.mutedForeground },
  eventOccasion: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.medium, flexShrink: 0 },
  eventLoc: { fontSize: typography.size.xs, color: colors.mutedForeground, flex: 1 },
  eventReadiness: {
    minWidth: 70,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  needsOutfitIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  readinessText: { fontSize: 10, color: colors.primary, fontWeight: typography.weight.semibold },
  readinessTextPlanned: { color: colors.success },

  pastToggle: {
    minHeight: 64,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pastToggleTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  pastToggleMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },

  pastCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: 68,
    opacity: 0.72,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pastDateBlock: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastMonth: { fontSize: 9, color: colors.mutedForeground, fontWeight: typography.weight.bold, letterSpacing: 0.6 },
  pastDay: { fontSize: typography.size.lg, color: colors.mutedForeground, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  pastBody: { flex: 1, gap: 2 },
  pastTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  pastDate: { fontSize: typography.size.xs, color: colors.mutedForeground },

  showMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: 44, borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  showMoreText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground, textAlign: 'center' },
  emptySubtitle: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center', maxWidth: 260 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    minHeight: 44,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  emptyBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },

  skeletonWrap: { gap: spacing.md, paddingTop: spacing.sm },
  skeletonHero: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderCurve: 'continuous',
  },
  skeletonHeroMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonDate: { width: 48, height: 52, borderRadius: radii.lg, backgroundColor: colors.muted },
  skeletonLine: { height: 10, borderRadius: radii.full, backgroundColor: colors.muted },
  skeletonRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  skeletonIcon: { width: 38, height: 38, borderRadius: radii.lg, backgroundColor: colors.muted },

});
