import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
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
  formatDayLabel,
  formatCountdown,
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
import { ensureEntitled } from '../../lib/entitlementGate';
import { useGlobalAIStylist, type StylistOpenSource } from '../../contexts/GlobalAIStylistContext';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { track } from '../../lib/analytics';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';
import type { StylistMissingEssential } from '../../features/stylist/types';
import { presentCalendarEvent } from '../../components/calendar/calendar-presentation';

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
  | { kind: 'loading'; key: string }
  | { kind: 'error'; key: string }
  | { kind: 'empty'; key: string }
  | { kind: 'hero'; key: string; event: Event }
  | { kind: 'day-heading'; key: string; dateStr: string }
  // A day the user tapped in the week strip that has no events of its own —
  // kept in its natural chronological slot so scrolling to it still lands
  // somewhere, carrying the same "add event / log wear" affordances the old
  // full-screen day filter used to show.
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

  // null = no day filter; a date string filters the list to that day
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
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

  // ── Floating header (ScreenHeader + WeekStrip), hide-on-scroll ────────────
  // Mirrors ClosetScreen's pattern: the header is absolutely positioned over
  // the list rather than living in ListHeaderComponent, so it can stay
  // pinned while the timeline scrolls beneath it. The list's own paddingTop
  // reserves exactly the header's measured height, and that measurement only
  // changes when the header's *content* changes (e.g. WeekStrip's month
  // grid expanding) — never during scroll — so FlashList recycling stays in
  // sync no matter how fast the user flings.
  const flashListRef = useRef<FlashListRef<CalendarTimelineItem>>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderCollapsed = useRef(false);

  const expandHeader = useCallback(() => {
    if (!isHeaderCollapsed.current) return;
    isHeaderCollapsed.current = false;
    Animated.spring(headerTranslateY, { toValue: 0, useNativeDriver: true, tension: 150, friction: 25 }).start();
  }, [headerTranslateY]);

  const collapseHeader = useCallback(() => {
    if (isHeaderCollapsed.current || headerHeight === 0) return;
    isHeaderCollapsed.current = true;
    Animated.spring(headerTranslateY, { toValue: -headerHeight, useNativeDriver: true, tension: 150, friction: 25 }).start();
  }, [headerTranslateY, headerHeight]);

  const handleListScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 10) expandHeader();
    else if (delta > 6) collapseHeader();
    else if (delta < -6) expandHeader();
  }, [expandHeader, collapseHeader]);

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
    if (isLoading) return [{ kind: 'loading', key: 'loading' }];
    if (isError) return [{ kind: 'error', key: 'error' }];
    if (events.length === 0) return [{ kind: 'empty', key: 'empty' }];

    // A day the user tapped in the week strip that has no events of its own
    // doesn't appear in `groupedUpcoming`/`past` at all — synthesize its slot
    // here so the timeline still has somewhere to scroll to. ISO yyyy-mm-dd
    // strings compare correctly, which keeps `new Date()` out of this memo's
    // dependencies.
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

    const items: CalendarTimelineItem[] = [];
    if (nextEvent) items.push({ kind: 'hero', key: `hero-${nextEvent.id}`, event: nextEvent });

    const dayGroups: { dateStr: string; group: Event[] }[] = groupedUpcoming.map(([dateStr, group]) => ({ dateStr, group }));
    if (selectedIsEmptyUpcomingDay) {
      dayGroups.push({ dateStr: selectedDate!, group: [] });
      dayGroups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }
    if (dayGroups.length > 0) {
      dayGroups.forEach(({ dateStr, group }) => {
        items.push({ kind: 'day-heading', key: `day-${dateStr}`, dateStr });
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

  // Scroll the timeline to whatever day is selected and flash it, instead of
  // swapping the whole list for a filtered one. If the target isn't in the
  // current `timelineItems` yet — its section is collapsed — expand that
  // section and let the effect re-run against the recomputed list rather
  // than guessing an index that doesn't exist yet.
  //
  // `timelineItems` gets a new array reference whenever `highlightDate`
  // changes — which this same effect sets — so without the "already
  // scrolled for this date" guard below, every run would trigger another
  // recompute that re-triggers the effect, forever.
  const scrolledForDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedDate) { scrolledForDateRef.current = null; return; }
    if (scrolledForDateRef.current === selectedDate) return;
    const isPastSelection = selectedDate < toDateStr(new Date());

    if (isPastSelection && !pastExpanded) { setPastExpanded(true); return; }

    let targetIndex = timelineItems.findIndex((item) => item.kind === 'day-heading' && item.dateStr === selectedDate);
    if (targetIndex === -1) {
      targetIndex = timelineItems.findIndex((item) => (
        (item.kind === 'past-event' && toDateStr(new Date(item.event.date)) === selectedDate) ||
        (item.kind === 'day-placeholder' && item.date === selectedDate)
      ));
    }

    if (targetIndex === -1) {
      if (!isPastSelection && !showAllUpcoming) { setShowAllUpcoming(true); return; }
      return;
    }

    scrolledForDateRef.current = selectedDate;
    // No `viewOffset` here even though the floating header would otherwise
    // cover the target row: on this FlashList version, combining `viewOffset`
    // with a jump of more than a screen or two lands wildly off-target
    // (verified against real data, not just a hunch). Landing the row at the
    // very top is fine in practice — a jump this size always collapses the
    // header via handleListScroll anyway.
    flashListRef.current?.scrollToIndex({
      index: targetIndex,
      animated: true,
      viewPosition: 0,
    });
    setHighlightDate(selectedDate);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightDate(null), 1600);
  }, [selectedDate, timelineItems, pastExpanded, showAllUpcoming, headerHeight]);

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
          if (!gap) return;
          navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: {
            priority: {
              label: gap.label,
              category: gap.category,
              reason: gap.reason === 'weather' || gap.reason === 'occasion' ? 'occasion' : gap.reason === 'ratio_imbalance' ? 'ratio_imbalance' : 'wardrobe_gap',
              context: gap.context,
              priority: gap.priority,
              unlocks: gap.unlocks ?? [],
            },
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
      setSelectedDate(toDateStr(eventDate));
      setWeekOffset(weekOffsetFor(eventDate));
      if (paramOpenDetail !== false) setDetailEvent(target);
    } else if (paramDate) {
      setSelectedDate(paramDate);
      setWeekOffset(weekOffsetFor(new Date(`${paramDate}T00:00:00`)));
    }
    clearParams();
  }, [paramEventId, paramDate, paramOpenDetail, events, isLoading, navigation]);

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
        <TouchableOpacity
          style={styles.eventMain}
          onPress={() => setDetailEvent(event)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${presentation.readinessLabel}`}
        >
          <View style={styles.eventDateBlock}>
            <Text style={styles.eventDateMonth}>{presentation.monthLabel}</Text>
            <Text style={styles.eventDateDay}>{presentation.dayLabel}</Text>
          </View>
          <View style={styles.eventBody}>
            <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
            <View style={styles.eventMeta}>
              <Text style={styles.eventTime}>{formatTime(new Date(event.date))}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.eventOccasion} numberOfLines={1}>{occasion}</Text>
            </View>
            {event.location ? <Text style={styles.eventLoc} numberOfLines={1}>{event.location}</Text> : null}
          </View>
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
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </TouchableOpacity>
        ) : (
          <View style={styles.eventReadiness}>
            <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
            <Text style={styles.readinessText}>Plan</Text>
          </View>
        )}
      </View>
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
      case 'day-placeholder':
        return (
          <View style={[styles.dayEmpty, item.date === highlightDate && styles.dayEmptyHighlighted]}>
            <View style={styles.dayEmptyIcon}>
              <Ionicons name="sunny-outline" size={19} color={colors.primary} />
            </View>
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
          />
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
                <Text style={styles.pastDate} numberOfLines={1}>
                  {new Date(item.event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              {!pastPresentation.hasOutfit ? (
                <Ionicons name="chevron-forward" size={14} color={colors.border} />
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
      {/* Content area + floating header — the header is measured and pinned
          over the list rather than living in ListHeaderComponent, so the
          week strip can stay visible while the timeline scrolls beneath it. */}
      <View style={styles.listArea}>
        <FlashList
          ref={flashListRef}
          data={timelineItems}
          renderItem={renderTimelineItem}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight, paddingBottom: spacing.xxxl * 2 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              progressViewOffset={headerHeight}
            />
          }
        />

        <Animated.View
          style={[styles.floatingHeader, { transform: [{ translateY: headerTranslateY }] }]}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h !== headerHeight) setHeaderHeight(h);
          }}
        >
          <ScreenHeader
            title="Calendar"
            subtitle="Plan ahead for every occasion."
            primaryAction={{ label: 'Add event', icon: 'add', onPress: handleAddEvent }}
            secondaryActions={[
              {
                label: 'More',
                accessibilityLabel: 'More calendar tools',
                icon: 'ellipsis-horizontal',
                variant: 'ghost',
                onPress: openCalendarUtilities,
              },
            ]}
          />
          <View style={styles.weekStripWrap}>
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
        </Animated.View>
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
  scrollContent: { paddingHorizontal: spacing.lg },

  // ── Floating header (absolute, slides over the list on scroll) ──────────
  listArea: { flex: 1, overflow: 'hidden' },
  floatingHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: colors.background,
  },
  weekStripWrap: { paddingHorizontal: spacing.lg },

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
  dayEmptyText: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, textAlign: 'center' },
  dayEmptyActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flexWrap: 'wrap', gap: spacing.sm,
  },
  dayEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full, backgroundColor: colors.surfaceSelected,
  },
  dayEmptyBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },

  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  dayLabel: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: typography.tracking.meta },
  dayDivider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dayCountdown: { ...typography.text.caption, fontWeight: typography.weight.medium, color: colors.primary },

  eventCard: {
    flexDirection: 'row', alignItems: 'stretch',
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  eventCardHighlighted: { backgroundColor: colors.surfaceSelected },
  eventMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eventDateBlock: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  eventBody: { flex: 1, minWidth: 0, gap: 3 },
  eventTitle: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  eventTime: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  dot: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  eventOccasion: { fontSize: typography.text.caption.fontSize, color: colors.primary, fontWeight: typography.weight.medium, flexShrink: 0 },
  eventLoc: { ...typography.text.caption, color: colors.mutedForeground, flexShrink: 1 },
  eventReadiness: {
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingLeft: spacing.sm,
  },
  eventLookButton: {
    minWidth: 64,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  readinessText: { ...typography.text.caption, color: colors.primary, fontWeight: typography.weight.semibold },

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
  pastToggleTitle: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  pastToggleMeta: { ...typography.text.caption, color: colors.mutedForeground, marginTop: 2 },

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
