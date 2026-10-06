import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
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
  groupByDate,
  OCCASIONS,
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
import { presentCalendarEvent } from '../../components/calendar/calendar-presentation';
import { findAgendaDateIndex, monthHeading, monthKey } from '../../components/calendar/calendarAgenda';

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
  | { kind: 'month-heading'; key: string; dateStr: string }
  | { kind: 'loading'; key: string }
  | { kind: 'error'; key: string }
  | { kind: 'empty'; key: string }
  | { kind: 'hero'; key: string; event: Event; highlighted: boolean }
  // A selected date with no events still needs a scroll destination and
  // the same add-event and wear-log actions as other dates.
  | { kind: 'day-placeholder'; key: string; date: string; isPast: boolean }
  | { kind: 'event'; key: string; event: Event; highlighted: boolean }
  | { kind: 'show-upcoming'; key: string; expanded: boolean; count: number }
  | { kind: 'past-toggle'; key: string; expanded: boolean; count: number }
  | { kind: 'past-event'; key: string; event: Event; highlighted: boolean };

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
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // null = no day selected; a date navigates to that day in the full agenda.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const { data: boards = [] } = useBoards();
  const { mutate: setEventBoard } = useSetEventBoard();
  const boardsById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);
  const [pickerEvent, setPickerEvent] = useState<Event | null>(null);
  const [outfitPickerEvent, setOutfitPickerEvent] = useState<Event | null>(null);
  const [returnToDetailEventId, setReturnToDetailEventId] = useState<number | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [calendarMenuVisible, setCalendarMenuVisible] = useState(false);

  // Transient tint applied to the row(s) a week-strip tap scrolled to, so the
  // jump reads as "here it is" rather than an unexplained scroll.
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current); }, []);

  // Keep the masthead in the data so the sticky calendar has a real item
  // offset. FlashList can pin item zero early when using ListHeaderComponent.
  const flashListRef = useRef<FlashListRef<CalendarTimelineItem>>(null);
  const [listHeaderHeight, setListHeaderHeight] = useState(0);
  const [weekStripHeight, setWeekStripHeight] = useState(0);
  const [isStripStuck, setIsStripStuck] = useState(false);
  const jumpRequestRef = useRef(0);

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

  const outfitsById = useMemo(
    () => new Map(outfits.map((outfit) => [outfit.id, outfit])),
    [outfits],
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

  const formInitialDate = useMemo(
    () => (selectedDate ? new Date(selectedDate + 'T09:00:00') : null),
    [selectedDate],
  );

  const nextEvent = upcoming[0] ?? null;
  const upcomingRest = upcoming.slice(1);
  const visibleUpcoming = showAllUpcoming ? upcomingRest : upcomingRest.slice(0, UPCOMING_LIMIT);
  const groupedUpcoming = useMemo(() => groupByDate(visibleUpcoming), [visibleUpcoming]);

  const timelineItems = useMemo<CalendarTimelineItem[]>(() => {
    const items: CalendarTimelineItem[] = [
      { kind: 'masthead', key: 'masthead' },
      { kind: 'week-strip', key: 'week-strip' },
    ];
    if (isLoading) return [...items, { kind: 'loading', key: 'loading' }];
    if (isError) return [...items, { kind: 'error', key: 'error' }];
    if (events.length === 0) {
      return selectedDate
        ? [...items, { kind: 'day-placeholder', key: `placeholder-${selectedDate}`, date: selectedDate, isPast: selectedDate < toDateStr(new Date()) }]
        : [...items, { kind: 'empty', key: 'empty' }];
    }

    // A selected day without events needs a real agenda destination. ISO
    // strings keep that placeholder in date order without extra parsing.
    const todayStr = toDateStr(new Date());
    const heroDateStr = nextEvent ? toDateStr(new Date(nextEvent.date)) : null;
    // Checked against the *full* upcoming list, not the possibly-truncated
    // `groupedUpcoming` — a day whose events are only hidden behind "View
    // all upcoming events" is not an empty day, and must not get a
    // placeholder in their place.
    const selectedIsEmptyUpcomingDay =
      !!selectedDate && selectedDate >= todayStr && selectedDate !== heroDateStr &&
      !upcomingRest.some((e) => toDateStr(new Date(e.date)) === selectedDate);
    const selectedIsEmptyPastDay =
      !!selectedDate && selectedDate < todayStr && !past.some((e) => toDateStr(new Date(e.date)) === selectedDate);

    let lastUpcomingMonth: string | null = null;
    const addMonthHeading = (dateStr: string) => {
      const key = monthKey(dateStr);
      if (lastUpcomingMonth === key) return;
      items.push({ kind: 'month-heading', key: `month-${key}`, dateStr });
      lastUpcomingMonth = key;
    };
    const emptyDayPrecedesHero = selectedIsEmptyUpcomingDay && !!heroDateStr && selectedDate! < heroDateStr;
    if (emptyDayPrecedesHero) {
      items.push({ kind: 'upcoming-heading', key: 'upcoming-heading' });
      addMonthHeading(selectedDate!);
      items.push({ kind: 'day-placeholder', key: `placeholder-${selectedDate}`, date: selectedDate!, isPast: false });
    }
    if (nextEvent) {
      if (!emptyDayPrecedesHero) items.push({ kind: 'upcoming-heading', key: 'upcoming-heading' });
      addMonthHeading(heroDateStr!);
      items.push({ kind: 'hero', key: `hero-${nextEvent.id}`, event: nextEvent, highlighted: heroDateStr === highlightDate });
    }

    const dayGroups: { dateStr: string; group: Event[] }[] = groupedUpcoming.map(([dateStr, group]) => ({ dateStr, group }));
    if (selectedIsEmptyUpcomingDay && !emptyDayPrecedesHero) {
      dayGroups.push({ dateStr: selectedDate!, group: [] });
      dayGroups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }
    if (dayGroups.length > 0) {
      dayGroups.forEach(({ dateStr, group }) => {
        if (!nextEvent && items.length === 1) items.push({ kind: 'upcoming-heading', key: 'upcoming-heading' });
        addMonthHeading(dateStr);
        if (group.length === 0) {
          items.push({ kind: 'day-placeholder', key: `placeholder-${dateStr}`, date: dateStr, isPast: false });
        } else {
          group.forEach((event) => items.push({
            kind: 'event', key: `event-${event.id}`, event, highlighted: dateStr === highlightDate,
          }));
        }
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

    if (past.length > 0 || selectedIsEmptyPastDay) {
      items.push({
        kind: 'past-toggle',
        key: 'past-toggle',
        expanded: pastExpanded,
        count: past.length,
      });
      if (pastExpanded) {
        const pastDateStrs = past.map((e) => toDateStr(new Date(e.date)));
        let placed = false;
        past.forEach((event, i) => {
          // Past is sorted newest-first; splice the placeholder in just
          // before the first row that's older than the selected date.
          if (!placed && selectedIsEmptyPastDay && selectedDate! > pastDateStrs[i]) {
            items.push({ kind: 'day-placeholder', key: `placeholder-${selectedDate}`, date: selectedDate!, isPast: true });
            placed = true;
          }
          items.push({
            kind: 'past-event', key: `past-${event.id}`, event, highlighted: pastDateStrs[i] === highlightDate,
          });
        });
        if (!placed && selectedIsEmptyPastDay) {
          items.push({ kind: 'day-placeholder', key: `placeholder-${selectedDate}`, date: selectedDate!, isPast: true });
        }
      }
    }

    return items;
  }, [
    UPCOMING_LIMIT,
    events.length,
    groupedUpcoming,
    highlightDate,
    isError,
    isLoading,
    nextEvent,
    past,
    pastExpanded,
    selectedDate,
    showAllUpcoming,
    upcomingRest,
  ]);

  // Expand hidden sections before locating a date. FlashList's viewOffset is
  // inaccurate on distant jumps in this version, so first materialize the
  // target by index, then use its measured layout for the final offset.
  const scrolledForDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedDate) { scrolledForDateRef.current = null; return; }
    if (scrolledForDateRef.current === selectedDate) return;
    if (isLoading || isError || calendarExpanded || listHeaderHeight === 0 || weekStripHeight === 0) return;
    const isPastSelection = selectedDate < toDateStr(new Date());

    if (isPastSelection && !pastExpanded) { setPastExpanded(true); return; }
    const lastVisibleDate = visibleUpcoming.length > 0
      ? toDateStr(new Date(visibleUpcoming[visibleUpcoming.length - 1].date))
      : nextEvent ? toDateStr(new Date(nextEvent.date)) : null;
    if (!isPastSelection && !showAllUpcoming && upcomingRest.length > UPCOMING_LIMIT &&
      lastVisibleDate && selectedDate > lastVisibleDate) {
      setShowAllUpcoming(true);
      return;
    }

    const targetIndex = findAgendaDateIndex(timelineItems, selectedDate);

    if (targetIndex === -1) {
      if (!isPastSelection && !showAllUpcoming) { setShowAllUpcoming(true); return; }
      return;
    }

    scrolledForDateRef.current = selectedDate;
    const request = ++jumpRequestRef.current;
    void flashListRef.current?.scrollToIndex({ index: targetIndex, animated: false, viewPosition: 0 })
      .then(() => {
        if (request !== jumpRequestRef.current) return;
        const layout = flashListRef.current?.getLayout(targetIndex);
        if (!layout) return;
        flashListRef.current?.scrollToOffset({
          offset: Math.max(0, layout.y - weekStripHeight - spacing.sm),
          animated: !reducedMotion,
        });
      });
    setHighlightDate(selectedDate);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightDate(null), 1600);
  }, [selectedDate, timelineItems, pastExpanded, showAllUpcoming, isLoading, isError, calendarExpanded, listHeaderHeight, weekStripHeight, visibleUpcoming, nextEvent, upcomingRest.length, reducedMotion]);

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
    confirmSheet({
      title: `Delete “${ev.title}”?`,
      message: 'This event will be removed from your calendar. This can’t be undone.',
      confirmLabel: 'Delete event',
      destructive: true,
      onConfirm: () => { deleteEventMutation.mutate(ev.id); setDetailEvent(null); },
    });
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
    setSelectedDate((prev) => {
      if (prev === s) { setHighlightDate(null); return null; }
      return s;
    });
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
      const eventDate = new Date(target.date);
      if (calendarExpanded) setWeekStripHeight(0);
      setCalendarExpanded(false);
      setMonthOffset(0);
      setSelectedDate(toDateStr(eventDate));
      setWeekOffset(weekOffsetFor(eventDate));
      if (paramOpenDetail !== false) setDetailEvent(target);
    } else if (paramDate) {
      if (calendarExpanded) setWeekStripHeight(0);
      setCalendarExpanded(false);
      setMonthOffset(0);
      setSelectedDate(paramDate);
      setWeekOffset(weekOffsetFor(new Date(`${paramDate}T00:00:00`)));
    }
    clearParams();
  }, [paramEventId, paramDate, paramOpenDetail, events, isLoading, navigation, calendarExpanded]);

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
    const occasion = OCCASIONS.find((option) => option.id === event.occasion)?.label ?? event.occasion;
    const presentation = presentCalendarEvent(event);
    return (
      <View style={[styles.eventCard, highlighted && styles.eventCardHighlighted]}>
        <View style={styles.eventDateBlock}>
          <Text style={styles.eventDateMonth}>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</Text>
          <Text style={styles.eventDateDay}>{presentation.dayLabel}</Text>
        </View>
        <View style={styles.eventBody}>
          <TouchableOpacity
            style={styles.eventMain}
            onPress={() => setDetailEvent(event)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}, ${presentation.readinessLabel}`}
          >
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            <View style={styles.eventMeta}>
              <Text style={styles.eventTime}>{formatTime(new Date(event.date))}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.eventOccasion}>{occasion}</Text>
            </View>
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
                jumpRequestRef.current += 1;
                setWeekOffset(0);
                setSelectedDate(null);
                setCalendarExpanded(false);
                setMonthOffset(0);
                flashListRef.current?.scrollToOffset({ offset: 0, animated: !reducedMotion });
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
        return <Text style={styles.upcomingHeading}>Upcoming events</Text>;
      case 'month-heading':
        return <Text style={styles.monthHeading}>{monthHeading(item.dateStr, new Date().getFullYear())}</Text>;
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
      case 'day-placeholder':
        return (
          <View style={[styles.dayEmpty, item.date === highlightDate && styles.dayEmptyHighlighted]}>
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
      case 'past-event': {
        const pastPresentation = presentCalendarEvent(item.event);
        return (
          <View style={[styles.pastCard, item.highlighted && styles.pastCardHighlighted]}>
            <TouchableOpacity
              style={styles.pastMain}
              onPress={() => setDetailEvent(item.event)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={item.event.title}
            >
              <View style={styles.pastDateBlock}>
                <Text style={styles.pastMonth}>{pastPresentation.monthLabel}</Text>
                <Text style={styles.pastDay}>{pastPresentation.dayLabel}</Text>
              </View>
              <View style={styles.pastBody}>
                <Text style={styles.pastTitle} numberOfLines={1}>{item.event.title}</Text>
                <Text style={styles.pastDate} numberOfLines={1}>{formatTime(new Date(item.event.date))}</Text>
              </View>
              {!pastPresentation.hasOutfit ? (
                <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
              ) : null}
            </TouchableOpacity>
            {pastPresentation.hasOutfit ? (
              <TouchableOpacity
                style={styles.pastLookButton}
                onPress={() => openAssignedOutfit(item.event)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${item.event.outfitId == null ? 'View details' : 'View outfit'} for ${item.event.title}, ${item.event.itemIds!.length} pieces`}
              >
                <ItemThumbStack itemIds={item.event.itemIds!} itemsById={itemsById} />
                <Text style={styles.pastLookText}>{item.event.outfitId == null ? 'Details' : 'Outfit'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      }
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
          onScroll={(e) => setIsStripStuck(e.nativeEvent.contentOffset.y >= listHeaderHeight)}
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
        onSelectBoard={(boardId) => {
          if (!detailEvent) return;
          setEventBoard({ id: detailEvent.id, boardId });
          setDetailEvent({ ...detailEvent, boardId });
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
  upcomingHeading: {
    ...typography.text.eyebrowLarge,
    color: colors.mutedForeground,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
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
  eventDateBlock: {
    width: 44,
    alignItems: 'center',
    paddingTop: 3,
  },
  eventDateMonth: {
    ...typography.text.eyebrow,
    color: colors.mutedForeground,
  },
  eventDateDay: {
    fontSize: typography.text.sheetTitle.fontSize,
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  eventBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  eventTitle: {
    ...typography.text.editorialSection, lineHeight: 27, color: colors.foreground,
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

  pastCard: {
    flexDirection: 'row', alignItems: 'stretch',
    minHeight: 68,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pastCardHighlighted: { backgroundColor: colors.surfaceSelected },
  pastMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pastDateBlock: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastMonth: { ...typography.text.eyebrow, color: colors.mutedForeground },
  pastDay: { fontSize: typography.text.sectionTitle.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  pastBody: { flex: 1, gap: 2 },
  // Past rows lean on muted type rather than row-level opacity — dimming the
  // whole row would wash out the garment photography along with the text.
  pastTitle: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  pastDate: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  pastLookButton: {
    minWidth: 76,
    minHeight: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    paddingLeft: spacing.sm,
  },
  pastLookText: {
    ...typography.text.caption,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },

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
