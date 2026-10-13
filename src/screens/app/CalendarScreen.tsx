import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  AppState,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  useEvents,
  useDeleteEvent,
  useSetEventBoard,
} from '../../hooks/useEvents';
import { useBoards } from '../../hooks/useBoards';
import {
  useOutfits,
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
import {
  toDateStr,
  formatTime,
} from '../../components/calendar/calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import { ErrorState } from '../../components/primitives/ErrorState';
import { ScreenHeader } from '../../components/primitives/Editorial';
import { ActionMenuSheet } from '../../components/primitives/ActionMenuSheet';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { shoppingPriorityFromDailyLookGap } from '../../lib/dailyLookPresentation';
import { ensureEntitled } from '../../lib/entitlementGate';
import { useGlobalAIStylist, type StylistOpenSource } from '../../contexts/GlobalAIStylistContext';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { track } from '../../lib/analytics';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';
import type { StylistMissingEssential } from '../../features/stylist/types';
import { presentCalendarEvent, occasionDisplayLabel } from '../../components/calendar/calendar-presentation';
import { eventDayKey, sortCalendarEvents, eventsForCalendarDay, agendaDayHeading } from '../../components/calendar/calendarAgenda';

const FREE_EVENT_LIMIT = 5;

/** Whole weeks between the Monday of `date`'s week and the Monday of this week. */
function weekOffsetFor(date: Date): number {
  const mondayOf = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    const dow = copy.getDay();
    copy.setDate(copy.getDate() - (dow === 0 ? 6 : dow - 1));
    return copy;
  };
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  // Rounded because DST makes some weeks 23 or 25 hours short of a clean multiple.
  return Math.round((mondayOf(date).getTime() - mondayOf(new Date()).getTime()) / msPerWeek);
}

type CalendarTimelineItem =
  | { kind: 'masthead'; key: string }
  | { kind: 'week-strip'; key: string }
  | { kind: 'upcoming-heading'; key: string }
  | { kind: 'day-heading'; key: string; dateStr: string }
  | { kind: 'loading'; key: string }
  | { kind: 'error'; key: string }
  | { kind: 'empty'; key: string }
  | { kind: 'no-upcoming'; key: string }
  | { kind: 'hero'; key: string; event: Event; highlighted: boolean }
  // An empty Day keeps its date-specific add-event and wear-log actions.
  | { kind: 'day-placeholder'; key: string; date: string; isPast: boolean }
  | { kind: 'event'; key: string; event: Event; highlighted: boolean }
  | { kind: 'show-upcoming'; key: string; expanded: boolean; count: number }
  | { kind: 'past-toggle'; key: string; expanded: boolean; count: number };

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

export function CalendarScreen({ navigation, route }: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { isPremium } = useEntitlement();
  const { activeLocation } = useActiveStylingLocation();
  const { openStylist } = useGlobalAIStylist();
  const { openLogger } = useGlobalOutfitLogger();
  const { data: events = [], isLoading, refetch, isRefetching, isError } = useEvents();
  const { data: allItems = [] } = useItems();
  const { data: outfits = [] } = useOutfits();
  const deleteEventMutation = useDeleteEvent();
  const outfitReturnEventId = useRef<number | null>(null);
  const stylistHandoffAt = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // null means Upcoming; a selected date filters the Day agenda.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const { data: boards = [] } = useBoards();
  const { mutateAsync: setEventBoard } = useSetEventBoard();
  const boardsById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);
  const [pickerEvent, setPickerEvent] = useState<Event | null>(null);
  const [outfitPickerEvent, setOutfitPickerEvent] = useState<Event | null>(null);
  const [returnToDetailEventId, setReturnToDetailEventId] = useState<number | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [calendarMenuVisible, setCalendarMenuVisible] = useState(false);

  const [todayStr, setTodayStr] = useState(() => toDateStr(new Date()));
  useEffect(() => {
    let previousToday = toDateStr(new Date());
    const refresh = () => {
      const nextToday = toDateStr(new Date());
      if (nextToday === previousToday) return;
      // Keep the browsed week anchored when a new week begins overnight.
      const weekShift = weekOffsetFor(new Date(`${previousToday}T12:00:00`));
      setWeekOffset((offset) => offset + weekShift);
      previousToday = nextToday;
      setTodayStr(nextToday);
    };
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  // Keep the masthead in the data so the sticky calendar has a real item
  // offset. FlashList can pin item zero early when using ListHeaderComponent.
  const flashListRef = useRef<FlashListRef<CalendarTimelineItem>>(null);
  // Re-tapping the Calendar tab scrolls back to the top.
  useScrollToTop(flashListRef);
  const [listHeaderHeight, setListHeaderHeight] = useState(0);
  const [weekStripHeight, setWeekStripHeight] = useState(0);
  const [isStripStuck, setIsStripStuck] = useState(false);
  const scrollOffsetRef = useRef(0);

  const UPCOMING_LIMIT = 4;

  const upcoming = useMemo(
    () => sortCalendarEvents(events.filter((event) => eventDayKey(event) >= todayStr)),
    [events, todayStr],
  );

  const outfitsById = useMemo(
    () => new Map(outfits.map((outfit) => [outfit.id, outfit])),
    [outfits],
  );

  const past = useMemo(
    () => sortCalendarEvents(events.filter((event) => eventDayKey(event) < todayStr)),
    [events, todayStr],
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
  }, [weekOffset, todayStr]);

  const eventDateSet = useMemo(
    () => new Set(events.map(eventDayKey)),
    [events],
  );

  const formInitialDate = useMemo(
    () => (selectedDate ? new Date(selectedDate + 'T09:00:00') : null),
    [selectedDate],
  );

  const nextEvent = upcoming[0] ?? null;
  const upcomingRest = upcoming.slice(1);
  const visibleUpcoming = showAllUpcoming ? upcomingRest : upcomingRest.slice(0, UPCOMING_LIMIT);
  const timelineItems = useMemo<CalendarTimelineItem[]>(() => {
    const items: CalendarTimelineItem[] = [
      { kind: 'masthead', key: 'masthead' },
      { kind: 'week-strip', key: 'week-strip' },
      { kind: 'upcoming-heading', key: 'view-controls' },
    ];
    if (isLoading) return [...items, { kind: 'loading', key: 'loading' }];
    if (isError) return [...items, { kind: 'error', key: 'error' }];
    if (selectedDate) {
      const selected = eventsForCalendarDay(events, selectedDate);
      items.push({ kind: 'day-heading', key: `day-${selectedDate}`, dateStr: selectedDate });
      if (!selected.length) items.push({ kind: 'day-placeholder', key: `empty-${selectedDate}`, date: selectedDate, isPast: selectedDate < todayStr });
      selected.forEach((event) => items.push({ kind: 'event', key: `event-${event.id}`, event, highlighted: false }));
      return items;
    }
    if (!events.length) return [...items, { kind: 'empty', key: 'empty' }];
    if (!nextEvent) items.push({ kind: 'no-upcoming', key: 'no-upcoming' });
    let lastDay: string | null = null;
    for (const event of nextEvent ? [nextEvent, ...visibleUpcoming] : []) {
      const day = eventDayKey(event);
      if (day !== lastDay) items.push({ kind: 'day-heading', key: `day-${day}`, dateStr: day });
      lastDay = day;
      items.push({ kind: event.id === nextEvent?.id ? 'hero' : 'event', key: `event-${event.id}`, event, highlighted: false });
    }
    if (upcomingRest.length > UPCOMING_LIMIT) items.push({ kind: 'show-upcoming', key: 'show-upcoming', expanded: showAllUpcoming, count: upcomingRest.length });
    if (past.length) {
      items.push({ kind: 'past-toggle', key: 'past-toggle', expanded: pastExpanded, count: past.length });
      if (pastExpanded) {
        const groups = new Map<string, Event[]>();
        for (const event of past) {
          const day = eventDayKey(event);
          groups.set(day, [...(groups.get(day) ?? []), event]);
        }
        for (const [day, group] of [...groups].reverse()) {
          items.push({ kind: 'day-heading', key: `past-day-${day}`, dateStr: day });
          group.forEach((event) => items.push({ kind: 'event', key: `past-${event.id}`, event, highlighted: false }));
        }
      }
    }
    return items;
  }, [events, isLoading, isError, selectedDate, todayStr, nextEvent, visibleUpcoming, upcomingRest.length, showAllUpcoming, past, pastExpanded]);

  // Keep visible masthead space when switching days. Only return to the agenda
  // start if the user has already scrolled beyond the pinned calendar.
  const revealAgenda = useCallback(() => {
    const offset = Math.min(Math.max(0, scrollOffsetRef.current), listHeaderHeight);
    requestAnimationFrame(() => flashListRef.current?.scrollToOffset({ offset, animated: !reducedMotion }));
  }, [listHeaderHeight, reducedMotion]);

  const handleAddEvent = async () => {
    if (!isPremium && events.length >= FREE_EVENT_LIMIT) {
      // No pre-confirmation dialog here on purpose: RC's own paywall already
      // explains what unlocks, so asking "want to see plans?" first would
      // just be a second dialog asking the same question.
      const entitled = await ensureEntitled(false);
      if (!entitled) return;
    }
    setEditingEvent(null);
    setReturnToDetailEventId(null);
    setFormVisible(true);
  };

  const handleEdit = (ev: Event) => {
    setReturnToDetailEventId(ev.id);
    setDetailEvent(null);
    setEditingEvent(ev);
    setTimeout(() => setFormVisible(true), 300);
  };

  const restoreDetailAfterChildClose = (eventId: number | null) => {
    if (eventId === null) return;
    setTimeout(() => {
      const event = eventsRef.current.find((candidate) => candidate.id === eventId);
      if (event) setDetailEvent(event);
    }, 300);
  };

  const openAssignedOutfit = (event: Event, fromDetail = false) => {
    if (event.outfitId == null) {
      if (!fromDetail) setDetailEvent(event);
      return;
    }

    outfitReturnEventId.current = event.id;
    const showOutfit = () => navigation.navigate('Closet', {
      screen: 'OutfitDetail',
      params: {
        outfitId: event.outfitId!,
        returnTo: 'Calendar',
        returnToEventId: event.id,
        returnToEventDetail: fromDetail,
      },
    });
    if (!fromDetail) {
      showOutfit();
      return;
    }
    setDetailEvent(null);
    setTimeout(showOutfit, 300);
  };

  const openItemPicker = (ev: Event, returnToDetail = false) => {
    setReturnToDetailEventId(returnToDetail ? ev.id : null);
    if (returnToDetail) setDetailEvent(null);
    const showPicker = () => setPickerEvent(ev);
    if (returnToDetail) setTimeout(showPicker, 300);
    else showPicker();
  };

  const openOutfitPicker = (ev: Event, returnToDetail = false) => {
    setReturnToDetailEventId(returnToDetail ? ev.id : null);
    if (returnToDetail) setDetailEvent(null);
    const showPicker = () => setOutfitPickerEvent(ev);
    if (returnToDetail) setTimeout(showPicker, 300);
    else showPicker();
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
    if (deleteEventMutation.isPending) return;
    confirmSheet({
      title: `${ev.calendarMetadata ? 'Remove' : 'Delete'} “${ev.title}”?`,
      message: ev.calendarMetadata ? 'This removes the event and its outfit plan from Styled. Your source calendar stays unchanged. ' + (ev.externalSource && ev.externalId ? 'This event will stay removed when its connected calendar syncs again.' : 'It may return when your calendar syncs again.') : 'This event and its outfit plan will be deleted from Styled. This can’t be undone.',
      confirmLabel: ev.calendarMetadata ? 'Remove from Styled' : 'Delete event',
      destructive: true,
      onConfirm: () => { deleteEventMutation.mutate(ev.id); setDetailEvent(null); },
    });
  };

  const openStylistForEvent = (event: Event, source: StylistOpenSource) => {
    const now = Date.now();
    if (now - stylistHandoffAt.current < 600) return;
    stylistHandoffAt.current = now;
    const details = [
      `Dress me for "${event.title}"`,
      `on ${new Date(`${eventDayKey(event)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
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
        initialMode: 'event_plan',
        source,
        eventContext: { id: event.id, title: event.title },
        onNavigateToCloset: (outfitId) => navigation.navigate('Closet', {
          screen: 'OutfitDetail',
          params: {
            outfitId,
            returnTo: 'Calendar',
            returnToEventId: event.id,
            returnToEventDetail: true,
          },
        }),
        onNavigateToShop: (gap?: StylistMissingEssential) => {
          if (!gap?.label) return;
          navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: {
            priority: shoppingPriorityFromDailyLookGap(gap),
          }});
        },
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

  const handleSelectDate = (s: string) => {
    if (calendarExpanded) setWeekStripHeight(0);
    setCalendarExpanded(false);
    setMonthOffset(0);
    setWeekOffset(weekOffsetFor(new Date(`${s}T00:00:00`)));
    setSelectedDate(s);
    revealAgenda();
  };

  // Arriving from a deep link or a child screen: focus that event's day, scroll
  // the week strip to it, and optionally reopen its detail sheet.
  const paramEventId = route.params?.eventId;
  const paramDate = route.params?.date;
  const paramOpenDetail = route.params?.openDetail;
  useEffect(() => {
    if (paramEventId == null && !paramDate) return;

    const clearParams = () => navigation.setParams({ eventId: undefined, date: undefined, openDetail: undefined });

    if (paramEventId != null) {
      const target = events.find((event) => event.id === paramEventId);
      if (!target) {
        // Events may still be in flight — hold the request rather than drop it.
        if (isLoading) return;
        clearParams();
        return;
      }
      if (outfitReturnEventId.current === target.id) {
        outfitReturnEventId.current = null;
        if (paramOpenDetail !== false) setDetailEvent(target);
        clearParams();
        return;
      }
      const eventDate = new Date(`${eventDayKey(target)}T12:00:00`);
      if (calendarExpanded) setWeekStripHeight(0);
      setCalendarExpanded(false);
      setMonthOffset(0);
      setSelectedDate(eventDayKey(target));
      setWeekOffset(weekOffsetFor(eventDate));
      revealAgenda();
      if (paramOpenDetail !== false) setDetailEvent(target);
    } else if (paramDate) {
      if (calendarExpanded) setWeekStripHeight(0);
      setCalendarExpanded(false);
      setMonthOffset(0);
      setSelectedDate(paramDate);
      revealAgenda();
      setWeekOffset(weekOffsetFor(new Date(`${paramDate}T00:00:00`)));
    }
    clearParams();
  }, [paramEventId, paramDate, paramOpenDetail, events, isLoading, navigation, calendarExpanded, revealAgenda]);

  // A wear log is a date-stamped record, so the calendar is its natural home.
  // Logging from a selected day pre-fills that date; the header logs today.
  const handleLogWear = useCallback((date?: string) => {
    track('outfit_log_opened', { source: date ? 'calendar_day' : 'calendar_header' });
    openLogger(date ? { date, quickStart: true } : { quickStart: true });
  }, [openLogger]);

  const openCalendarUtilities = useCallback(() => {
    setCalendarMenuVisible(true);
  }, []);

  const renderEventCard = (event: Event, highlighted: boolean) => {
    const occasion = occasionDisplayLabel(event.occasion);
    const presentation = presentCalendarEvent(event);
    return (
      <View style={[styles.eventCard, highlighted && styles.eventCardHighlighted]}>
        <View style={styles.eventBody}>
          <TouchableOpacity
            style={styles.eventMain}
            onPress={() => setDetailEvent(event)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}, ${presentation.readinessLabel}`}
          >
            <View style={styles.eventMeta}>
              <Text style={styles.eventTime}>{event.calendarMetadata?.allDay ? 'All day' : formatTime(new Date(event.date))}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.eventOccasion}>{occasion}</Text>
            </View>
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            {event.location ? <Text style={styles.eventLoc} numberOfLines={2}>{event.location}</Text> : null}
          </TouchableOpacity>
          {presentation.hasOutfit ? (
            <TouchableOpacity
              style={styles.eventLookButton}
              onPress={() => openAssignedOutfit(event)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${event.outfitId == null ? 'View details' : 'View outfit'} for ${event.title}, ${event.itemIds!.length} pieces`}
            >
              <ItemThumbStack itemIds={event.itemIds!} itemsById={itemsById} />
              <Text style={styles.readinessText}>Outfit planned</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : (
            <View style={styles.eventReadiness}>
              <Ionicons name="sparkles-outline" size={13} color={colors.mutedForeground} />
              <Text style={styles.readinessText}>Needs outfit</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTimelineItem = ({ item, target }: { item: CalendarTimelineItem; target?: string }) => {
    switch (item.kind) {
      case 'masthead':
        return (
          <View onLayout={(e) => setListHeaderHeight(Math.round(e.nativeEvent.layout.height))}>
            <ScreenHeader
              title="Calendar"
              titleVariant="display"
              subtitle="Plan ahead"
              safeTop={false}
              style={styles.screenHeader}
              primaryAction={{ label: 'Add event', icon: 'add', onPress: handleAddEvent }}
              secondaryActions={[
                {
                  label: 'More',
                  accessibilityLabel: 'More calendar tools',
                  icon: 'ellipsis-horizontal',
                  variant: 'secondary',
                  onPress: openCalendarUtilities,
                },
              ]}
            />
          </View>
        );
      case 'week-strip':
        const stripIsAccessible = target === 'StickyHeader' ? isStripStuck : target === 'Measurement' ? false : !isStripStuck;
        return (
          <View
            style={[styles.weekStripWrap, target === 'StickyHeader' && styles.stickyWeekStripWrap]}
            onLayout={target === 'StickyHeader' ? undefined : (e) => setWeekStripHeight(Math.round(e.nativeEvent.layout.height))}
            accessibilityElementsHidden={!stripIsAccessible}
            importantForAccessibility={stripIsAccessible ? 'auto' : 'no-hide-descendants'}
          >
            <WeekStrip
              weekDays={weekDays}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onPrevWeek={() => setWeekOffset((offset) => offset - 1)}
              onNextWeek={() => setWeekOffset((offset) => offset + 1)}
              onToday={() => {
                handleSelectDate(toDateStr(new Date()));
              }}
              eventDateSet={eventDateSet}
              weekOffset={weekOffset}
              expanded={calendarExpanded}
              monthOffset={monthOffset}
              onToggleExpanded={() => {
                setCalendarExpanded((value) => !value);
                if (calendarExpanded) setMonthOffset(0);
              }}
              onChangeMonthOffset={(delta) => setMonthOffset((value) => value + delta)}
            />
          </View>
        );
      case 'upcoming-heading':
        return (
          <View style={styles.viewControls} accessibilityRole="tablist">
            {(['Upcoming', 'Day'] as const).map((label) => {
              const active = label === 'Day' ? selectedDate !== null : selectedDate === null;
              return <TouchableOpacity key={label} accessibilityRole="tab" accessibilityState={{ selected: active }}
                style={[styles.viewButton, active && styles.viewButtonActive]}
                onPress={() => { if (label === 'Day') handleSelectDate(selectedDate ?? toDateStr(new Date())); else { setSelectedDate(null); revealAgenda(); } }}>
                <Text style={[styles.viewButtonText, active && styles.viewButtonTextActive]}>{label}</Text>
              </TouchableOpacity>;
            })}
          </View>
        );
      case 'day-heading':
        return <Text accessibilityRole="header" style={styles.monthHeading}>{agendaDayHeading(item.dateStr)}</Text>;
      case 'loading':
        return <CalendarLoadingSkeleton />;
      case 'error':
        return <ErrorState message="Couldn't load events" onRetry={refetch} />;
      case 'no-upcoming':
        return <View style={styles.dayEmpty}>
          <Text style={styles.emptyTitle}>Your calendar is clear</Text>
          <Text style={styles.emptySubtitle}>Add an occasion to plan your next look.</Text>
          <TouchableOpacity style={styles.dayEmptyBtn} accessibilityRole="button" onPress={handleAddEvent}>
            <Ionicons name="add" size={14} color={colors.primary} /><Text style={styles.dayEmptyBtnText}>Add event</Text>
          </TouchableOpacity>
        </View>;
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
      case 'day-placeholder':
        return (
          <View style={styles.dayEmpty}>
            <View style={styles.dayEmptyIcon}>
              <Ionicons name="sunny-outline" size={19} color={colors.primary} />
            </View>
            <Text style={styles.dayEmptyDate}>
              {new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text style={styles.dayEmptyTitle}>Nothing planned</Text>
            <Text style={styles.dayEmptyText}>
              {item.isPast
                ? 'What did you wear, or add the occasion.'
                : 'Keep the day open or add an occasion.'}
            </Text>
            <View style={styles.dayEmptyActions}>
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
              <TouchableOpacity
                style={styles.dayEmptyBtn}
                onPress={() => handleLogWear(item.date)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="What did you wear on this day"
              >
                <Ionicons name="checkmark-done-outline" size={14} color={colors.primary} />
                <Text style={styles.dayEmptyBtnText}>Log wear</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'hero':
        return (
          <NextEventHero
            event={item.event}
            allItems={allItems}
            outfit={item.event.outfitId == null ? null : outfitsById.get(item.event.outfitId) ?? null}
            weatherFallback={activeLocation}
            onPress={() => setDetailEvent(item.event)}
            onPlanOutfit={() => openStylistForEvent(item.event, 'calendar_hero')}
            onOpenOutfit={() => openAssignedOutfit(item.event)}
            isPlanning={false}
            highlighted={item.highlighted}
          />
        );
      case 'event':
        return renderEventCard(item.event, item.highlighted);
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
            style={[styles.pastToggle, visibleUpcoming.length === 0 && styles.pastToggleWithDivider]}
            onPress={() => setPastExpanded(!item.expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: item.expanded }}
            accessibilityLabel={`${item.expanded ? 'Collapse' : 'Expand'} ${item.count} past events`}
          >
            <Text style={styles.pastToggleTitle}>Past events · {item.count}</Text>
            <Ionicons name={item.expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        );

    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.listArea, { paddingTop: insets.top }]}>
        <FlashList
          ref={flashListRef}
          data={timelineItems}
          renderItem={renderTimelineItem}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          stickyHeaderIndices={[1]}
          // Calendar expansion and explicit date jumps own the scroll position.
          // Automatic anchoring can counteract them as row heights change.
          maintainVisibleContentPosition={{ disabled: true }}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xxxl * 2 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            setIsStripStuck(e.nativeEvent.contentOffset.y >= listHeaderHeight);
          }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              progressViewOffset={weekStripHeight}
            />
          }
        />
      </View>

      {/* Modals */}
      <EventDetailModal
        event={detailEvent}
        visible={detailEvent !== null}
        onClose={() => setDetailEvent(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAssign={(ev) => openItemPicker(ev, true)}
        onChooseOutfit={(ev) => openOutfitPicker(ev, true)}
        onOpenOutfit={(ev) => openAssignedOutfit(ev, true)}
        allItems={allItems}
        onOpenStylist={(event) => openStylistForEvent(event, 'event_detail')}
        weatherFallback={activeLocation}
        outfit={detailEvent?.outfitId == null ? null : outfitsById.get(detailEvent.outfitId) ?? null}
        board={detailEvent?.boardId == null ? null : boardsById.get(detailEvent.boardId) ?? null}
        onSelectBoard={async (boardId) => {
          if (!detailEvent) return;
          const updatedEvent = await setEventBoard({ id: detailEvent.id, boardId });
          setDetailEvent((current) => current?.id === updatedEvent.id ? updatedEvent : current);
        }}
        onOpenBoard={(boardId) => {
          setDetailEvent(null);
          // CalendarScreen's navigation prop is already composite, so the tab
          // is addressed directly here — getParent() is for screens nested in
          // a stack, like BoardDetail.
          navigation.navigate('Closet', { screen: 'BoardDetail', params: { boardId } });
        }}
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
      <ActionMenuSheet
        visible={calendarMenuVisible}
        deferSelectionUntilDismissed
        compact
        title="Calendar tools"
        subtitle="Keep your wardrobe plan up to date."
        options={[
          { label: 'Log wear', icon: 'shirt-outline', onPress: () => handleLogWear(selectedDate ?? undefined) },
          { label: 'Calendars & sync', icon: 'calendar-outline', onPress: () => setSyncVisible(true) },
        ]}
        onClose={() => setCalendarMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.page },

  listArea: { flex: 1, overflow: 'hidden' },
  screenHeader: { marginHorizontal: -spacing.page, paddingTop: spacing.md },
  weekStripWrap: {
    marginHorizontal: -spacing.page,
    paddingHorizontal: spacing.page,
    backgroundColor: colors.background,
  },
  // FlashList renders sticky copies outside the padded content container.
  // Cancel the page gutter only for the in-list copy, never the pinned copy.
  stickyWeekStripWrap: { marginHorizontal: 0 },
  viewControls: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.sm },
  viewButton: { minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radii.action },
  viewButtonActive: { backgroundColor: colors.surfaceSelected },
  viewButtonText: { ...typography.text.label, color: colors.mutedForeground },
  viewButtonTextActive: { color: colors.primary },
  monthHeading: {
    ...typography.text.label,
    color: colors.mutedForeground,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  dayEmpty: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
    borderRadius: radii.xl,
  },
  dayEmptyHighlighted: { backgroundColor: colors.surfaceSelected, borderColor: colors.border },
  dayEmptyIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  dayEmptyTitle: { fontSize: typography.text.body.fontSize, color: colors.foreground, fontWeight: typography.weight.semibold },
  dayEmptyDate: { ...typography.text.meta, color: colors.mutedForeground, textAlign: 'center' },
  dayEmptyText: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, textAlign: 'center' },
  dayEmptyActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flexWrap: 'wrap', gap: spacing.sm,
  },
  dayEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full, backgroundColor: colors.surfaceSelected,
  },
  dayEmptyBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },

  eventCard: {
    flexDirection: 'row', alignItems: 'stretch',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  eventCardHighlighted: { backgroundColor: colors.surfaceSelected },
  eventMain: {
    minHeight: 44,
    gap: 3,
  },
  eventBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  eventTitle: {
    ...typography.text.editorialCard, color: colors.foreground,
  },
  eventMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
  eventTime: {
    ...typography.text.meta, color: colors.mutedForeground,
  },
  dot: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  eventOccasion: { fontSize: typography.text.caption.fontSize, color: colors.primary, fontWeight: typography.weight.medium },
  eventLoc: { ...typography.text.caption, color: colors.mutedForeground },
  eventReadiness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventLookButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  readinessText: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  pastToggle: {
    minHeight: 52,
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: colors.border,
  },
  pastToggleWithDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  pastToggleTitle: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground },

  showMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: 44, borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  showMoreText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground, textAlign: 'center' },
  emptySubtitle: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, textAlign: 'center', maxWidth: 260 },
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
  emptyBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.white },

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
