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
import { useOutfitLogs, useCreateOutfitLog } from '../../hooks/useOutfitLogs';
import * as Haptics from '../../lib/haptics';
import { isLookWornOn, buildDayThumbs, groupWearLogsByDay } from '../../components/calendar/calendar-presentation';
import { CalendarSyncSheet } from '../../components/calendar/CalendarSyncSheet';
import { WeekStrip } from '../../components/calendar/WeekStrip';
import { EventFormModal } from '../../components/calendar/EventFormModal';
import { EventDetailModal } from '../../components/calendar/EventDetailModal';
import { EventItemPickerModal } from '../../components/calendar/EventItemPickerModal';
import { EventOutfitPickerModal } from '../../components/calendar/EventOutfitPickerModal';
import { AgendaEventRow, AllDayBanner } from '../../components/calendar/AgendaEventRow';
import { useEventStylistHandoff } from '../../components/calendar/useEventStylistHandoff';
import { NextEventHero } from '../../components/calendar/NextEventHero';
import { toDateStr } from '../../components/calendar/calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import { ErrorState } from '../../components/primitives/ErrorState';
import { ActionMenuSheet } from '../../components/primitives/ActionMenuSheet';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { ensureEntitled } from '../../lib/entitlementGate';
import { useGlobalAIStylist, type StylistOpenSource } from '../../contexts/GlobalAIStylistContext';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { track } from '../../lib/analytics';
import { useTrips } from '../../hooks/useTrips';
import { TripDayBand, tripOnDate } from '../../components/calendar/TripDayBand';
import { TripDetailModal } from '../../components/trips/TripDetailModal';
import { UpcomingTripsRow } from '../../components/trips/UpcomingTripsRow';
import { pastTrips, tripProgressLabel, upcomingTrips } from '../../features/trips/presentation';
import { isTripLikeEvent, tripForEvent, tripPrefillFromEvent } from '../../features/trips/eventTrips';
import { tripSpanLabel } from '../../features/stylist/workflows';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';
import {
  eventDayKey,
  sortCalendarEvents,
  agendaDayHeading,
  buildAgendaWindow,
  buildPlanningStatusMap,
  windowCountsForDate,
} from '../../components/calendar/calendarAgenda';

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

/** Event days loaded each time the agenda reaches either end. */
const FUTURE_PAGE = 30;
const PAST_PAGE = 14;

type CalendarTimelineItem =
  | { kind: 'earlier'; key: string }
  | { kind: 'day-heading'; key: string; date: string }
  | { kind: 'loading'; key: string }
  | { kind: 'error'; key: string }
  | { kind: 'empty'; key: string }
  | { kind: 'no-upcoming'; key: string }
  | { kind: 'hero'; key: string; date: string; event: Event }
  // An empty day the user chose keeps its date-specific add-event and wear-log actions.
  | { kind: 'day-placeholder'; key: string; date: string; isPast: boolean }
  | { kind: 'all-day'; key: string; date: string; event: Event }
  | { kind: 'event'; key: string; date: string; event: Event };

const itemDate = (item: CalendarTimelineItem): string | null => ('date' in item ? item.date : null);

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
  const { data: trips = [] } = useTrips();
  const [openTripId, setOpenTripId] = useState<number | null>(null);
  const openTrip = trips.find((trip) => trip.id === openTripId);
  const [pastTripsVisible, setPastTripsVisible] = useState(false);
  const { openLogger } = useGlobalOutfitLogger();
  const { data: events = [], isLoading, refetch, isRefetching, isError } = useEvents();
  const { data: allItems = [] } = useItems();
  const { data: outfits = [] } = useOutfits();
  const deleteEventMutation = useDeleteEvent();
  const { data: outfitLogs = [] } = useOutfitLogs();
  const createOutfitLog = useCreateOutfitLog();
  const [wearingEventId, setWearingEventId] = useState<number | null>(null);
  const outfitReturnEventId = useRef<number | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // The strip's selection. It follows the agenda as it scrolls and drives it
  // when a date is tapped.
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const { data: boards = [] } = useBoards();
  const { mutateAsync: setEventBoard } = useSetEventBoard();
  const boardsById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const [pickerEvent, setPickerEvent] = useState<Event | null>(null);
  const [outfitPickerEvent, setOutfitPickerEvent] = useState<Event | null>(null);
  const [returnToDetailEventId, setReturnToDetailEventId] = useState<number | null>(null);
  const [pastDayCount, setPastDayCount] = useState(0);
  const [futureDayCount, setFutureDayCount] = useState(FUTURE_PAGE);
  // A tapped day without events is kept in the timeline so it can be shown.
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);
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

  const flashListRef = useRef<FlashListRef<CalendarTimelineItem>>(null);
  // Re-tapping the Calendar tab scrolls back to the top.
  useScrollToTop(flashListRef);
  // A date the agenda should scroll to once the timeline includes it. An
  // object, so tapping the same date twice still scrolls.
  const [scrollRequest, setScrollRequest] = useState<{ date: string } | null>(null);
  // While the list moves on its own, its scroll must not feed back into the
  // strip. Cleared as soon as the user touches the list again.
  const programmaticScroll = useRef(false);

  const upcoming = useMemo(
    () => sortCalendarEvents(events.filter((event) => eventDayKey(event) >= todayStr)),
    [events, todayStr],
  );

  const outfitsById = useMemo(
    () => new Map(outfits.map((outfit) => [outfit.id, outfit])),
    [outfits],
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

  const planningStatus = useMemo(() => buildPlanningStatusMap(events), [events]);
  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);
  const dayThumbs = useMemo(
    () => buildDayThumbs(sortCalendarEvents(events), itemsById, eventDayKey),
    [events, itemsById],
  );
  const logsByDay = useMemo(() => groupWearLogsByDay(outfitLogs), [outfitLogs]);

  const formInitialDate = useMemo(
    () => (pinnedDate ? new Date(pinnedDate + 'T09:00:00') : null),
    [pinnedDate],
  );

  const nextEvent = upcoming[0] ?? null;
  const agenda = useMemo(
    () => buildAgendaWindow(events, { todayStr, pastDayCount, futureDayCount, pinnedDate }),
    [events, todayStr, pastDayCount, futureDayCount, pinnedDate],
  );
  const timelineItems = useMemo<CalendarTimelineItem[]>(() => {
    if (isLoading) return [{ kind: 'loading', key: 'loading' }];
    if (isError) return [{ kind: 'error', key: 'error' }];
    if (!events.length && !pinnedDate) return [{ kind: 'empty', key: 'empty' }];
    const items: CalendarTimelineItem[] = [];
    if (agenda.earlierCount > 0) items.push({ kind: 'earlier', key: 'earlier' });
    let shownNoUpcoming = false;
    for (const day of agenda.days) {
      if (!nextEvent && !shownNoUpcoming && day.date >= todayStr) {
        items.push({ kind: 'no-upcoming', key: 'no-upcoming' });
        shownNoUpcoming = true;
      }
      const { date } = day;
      items.push({ kind: 'day-heading', key: `day-${date}`, date });
      if (!day.allDay.length && !day.timed.length) {
        items.push({ kind: 'day-placeholder', key: `empty-${date}`, date, isPast: date < todayStr });
        continue;
      }
      for (const event of [...day.allDay, ...day.timed]) {
        if (event.id === nextEvent?.id) items.push({ kind: 'hero', key: `event-${event.id}`, date, event });
        else if (event.calendarMetadata?.allDay) items.push({ kind: 'all-day', key: `event-${event.id}`, date, event });
        else items.push({ kind: 'event', key: `event-${event.id}`, date, event });
      }
    }
    if (!nextEvent && !shownNoUpcoming) items.push({ kind: 'no-upcoming', key: 'no-upcoming' });
    return items;
  }, [events.length, isLoading, isError, agenda, nextEvent, todayStr, pinnedDate]);

  // Land on a requested date once the timeline contains it.
  useEffect(() => {
    if (!scrollRequest) return;
    const index = timelineItems.findIndex((item) => item.kind === 'day-heading' && item.date >= scrollRequest.date);
    if (index < 0) return;
    setScrollRequest(null);
    programmaticScroll.current = true;
    requestAnimationFrame(() => {
      void flashListRef.current?.scrollToIndex({ index, animated: !reducedMotion, viewPosition: 0 });
    });
  }, [scrollRequest, timelineItems, reducedMotion]);

  const showWeekOf = useCallback((date: string) => {
    setWeekOffset(weekOffsetFor(new Date(`${date}T00:00:00`)));
  }, []);

  // Agenda scroll moves the strip; the strip's own taps are excluded above.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: CalendarTimelineItem }[] }) => {
    if (programmaticScroll.current) return;
    const date = viewableItems.map(({ item }) => itemDate(item)).find(Boolean);
    if (!date) return;
    setSelectedDate((current) => (current === date ? current : date));
    showWeekOf(date);
  }).current;

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

  const handOffToStylist = useEventStylistHandoff(navigation);
  const openStylistForEvent = (event: Event, source: StylistOpenSource) => {
    // Let the detail modal finish dismissing before presenting the stylist sheet
    const delay = detailEvent ? 300 : 0;
    setDetailEvent(null);
    handOffToStylist(event, source, delay);
  };

  // The agenda's one-tap plan button: a trip event's plan is the trip.
  const planFromAgenda = (event: Event, source: StylistOpenSource) => {
    if (isTripLikeEvent(event)) openTripForEvent(event);
    else openStylistForEvent(event, source);
  };

  // A trip in the calendar gets a trip plan, not an outfit: open the plan linked
  // to it, or start the trip brief pre-filled from the event.
  const openTripForEvent = (event: Event, delay = 0) => {
    const linked = tripForEvent(trips, event.id);
    track(linked ? 'trip_opened' : 'trip_plan_started', { source: 'calendar_event' });
    setTimeout(() => {
      if (linked) setOpenTripId(linked.id);
      else openStylist({ source: 'calendar_card', workflow: { kind: 'trip', ...tripPrefillFromEvent(event) } });
    }, delay);
  };

  const tripActionFor = (event: Event | null) => {
    if (!event || !isTripLikeEvent(event)) return undefined;
    const linked = tripForEvent(trips, event.id);
    const prefill = tripPrefillFromEvent(event);
    const range = tripSpanLabel(prefill.startDate!, prefill.endDate!);
    return linked
      ? { planned: true, title: 'Trip planned', detail: linked.eventDatesChanged ? 'Dates changed · re-plan' : tripProgressLabel(linked), onPress: closeDetailThenOpenTrip }
      : { planned: false, title: 'Plan this trip', detail: [prefill.destination, range?.range, range?.nights].filter(Boolean).join(' · '), onPress: closeDetailThenOpenTrip };
  };

  const closeDetailThenOpenTrip = (event: Event) => {
    setDetailEvent(null);
    openTripForEvent(event, 400);
  };

  const handleSelectDate = useCallback((date: string) => {
    setCalendarExpanded(false);
    setMonthOffset(0);
    showWeekOf(date);
    setSelectedDate(date);
    const hasEvents = planningStatus.has(date);
    setPinnedDate(hasEvents ? null : date);
    // Grow the window so a jump beyond what is loaded still has a landing.
    const needed = windowCountsForDate(events, date, todayStr);
    setPastDayCount((count) => Math.max(count, needed.past));
    setFutureDayCount((count) => Math.max(count, needed.future + 1));
    setScrollRequest({ date });
  }, [events, planningStatus, showWeekOf, todayStr]);

  // Arriving from a deep link or a child screen: focus that event's day, scroll
  // the agenda to it, and optionally reopen its detail sheet.
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
        // Returning from the outfit keeps the agenda where the user left it.
        outfitReturnEventId.current = null;
        if (paramOpenDetail !== false) setDetailEvent(target);
        clearParams();
        return;
      }
      handleSelectDate(eventDayKey(target));
      if (paramOpenDetail !== false) setDetailEvent(target);
    } else if (paramDate) {
      handleSelectDate(paramDate);
    }
    clearParams();
  }, [paramEventId, paramDate, paramOpenDetail, events, isLoading, navigation, handleSelectDate]);

  // A wear log is a date-stamped record, so the calendar is its natural home.
  // Logging from a selected day pre-fills that date; the header logs today.
  const handleLogWear = useCallback((date?: string) => {
    track('outfit_log_opened', { source: date ? 'calendar_day' : 'calendar_header' });
    openLogger(date ? { date, quickStart: true } : { quickStart: true });
  }, [openLogger]);

  const isWorn = (event: Event) => isLookWornOn(logsByDay.get(eventDayKey(event)) ?? [], event.itemIds, eventDayKey(event));

  // What a past event's day actually saw: the planned look if it was logged,
  // otherwise the day's first wear log.
  const wornItemIdsFor = (event: Event): number[] | null => {
    const logs = logsByDay.get(eventDayKey(event));
    if (!logs?.length) return null;
    if (isWorn(event)) return event.itemIds!;
    return logs[0].itemIds.length ? logs[0].itemIds : null;
  };

  // An open day is a styling opportunity, not a blank: weekends get a
  // weekend look, weekdays a look for that day.
  const openStylistForFreeDay = (date: string) => {
    const day = new Date(`${date}T12:00:00`);
    const weekday = day.toLocaleDateString('en-US', { weekday: 'long' });
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    track('calendar_free_day_styled', { weekend });
    openStylist({
      initialQuery: weekend
        ? `Put together a relaxed weekend look for ${weekday}, ${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`
        : `What should I wear on ${weekday}, ${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}?`,
      source: 'calendar_card',
    });
  };

  // A planned look becomes a wear log in one tap on the event's own day.
  const handleWear = (event: Event) => {
    if (!event.itemIds?.length || wearingEventId !== null || isWorn(event)) return;
    setWearingEventId(event.id);
    createOutfitLog.mutate(
      { itemIds: event.itemIds, date: eventDayKey(event), location: event.location ?? undefined },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          track('calendar_look_worn', { source: detailEvent ? 'event_detail' : 'calendar_hero' });
        },
        onSettled: () => setWearingEventId(null),
      },
    );
  };

  const tripsToday = toDateStr(new Date());
  const tripShelf = useMemo(() => upcomingTrips(trips, tripsToday), [trips, tripsToday]);
  const tripArchive = useMemo(() => pastTrips(trips, tripsToday), [trips, tripsToday]);

  // The trip brief opens over a fresh stylist thread; a future selected day
  // becomes the first day of the trip.
  const planTrip = useCallback((source: 'calendar_trips' | 'calendar_menu') => {
    track('trip_plan_started', { source });
    openStylist({
      source: 'calendar_card',
      workflow: { kind: 'trip', startDate: selectedDate > tripsToday ? selectedDate : undefined },
    });
  }, [openStylist, selectedDate, tripsToday]);

  const openCalendarUtilities = useCallback(() => {
    setCalendarMenuVisible(true);
  }, []);

  const outfitFor = (event: Event) => (event.outfitId == null ? null : outfitsById.get(event.outfitId) ?? null);

  const renderTimelineItem = ({ item, target }: { item: CalendarTimelineItem; target?: string }) => {
    switch (item.kind) {
      case 'earlier':
        return (
          <TouchableOpacity
            style={styles.earlier}
            onPress={() => setPastDayCount((count) => count + PAST_PAGE)}
            accessibilityRole="button"
            accessibilityLabel="Show earlier days"
          >
            <Ionicons name="chevron-up" size={14} color={colors.mutedForeground} />
            <Text style={styles.earlierText}>Earlier</Text>
          </TouchableOpacity>
        );
      case 'day-heading': {
        const heading = agendaDayHeading(item.date);
        const [prefix, rest] = heading.includes(' · ') ? heading.split(' · ') : [null, heading];
        const trip = tripOnDate(trips, item.date);
        const title = (
          <Text accessibilityRole="header" style={styles.dayHeading}>
            {prefix ? <Text style={item.date === todayStr ? styles.dayHeadingToday : undefined}>{prefix} · </Text> : null}
            {rest}
          </Text>
        );
        return trip ? <View>{title}<TripDayBand trip={trip} date={item.date} onPress={() => setOpenTripId(trip.id)} /></View> : title;
      }
      case 'loading':
        return <CalendarLoadingSkeleton />;
      case 'error':
        return <ErrorState message="Couldn't load events" onRetry={refetch} />;
      case 'no-upcoming':
        return <View style={[styles.freeDay, styles.noUpcoming]}>
          <Text style={styles.freeDayTitle}>Your calendar is clear</Text>
          <Text style={styles.freeDayText}>Add an occasion to plan your next look.</Text>
          <View style={styles.dayEmptyActions}>
            <TouchableOpacity style={styles.dayEmptyBtn} accessibilityRole="button" onPress={handleAddEvent}>
              <Ionicons name="add" size={14} color={colors.primary} /><Text style={styles.dayEmptyBtnText}>Add event</Text>
            </TouchableOpacity>
          </View>
        </View>;
      case 'empty':
        return (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="calendar-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your style calendar starts here</Text>
            <Text style={styles.emptySubtitle}>
              Connect your calendar or add an occasion, and Styled will help you prepare the look.
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
            <TouchableOpacity
              style={styles.emptyLink}
              onPress={() => setSyncVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Connect a calendar"
            >
              <Ionicons name="sync-outline" size={14} color={colors.foreground} />
              <Text style={styles.emptyLinkText}>Connect a calendar</Text>
            </TouchableOpacity>
          </View>
        );
      case 'day-placeholder': {
        const day = new Date(`${item.date}T12:00:00`);
        const weekday = day.toLocaleDateString('en-US', { weekday: 'long' });
        const weekend = day.getDay() === 0 || day.getDay() === 6;
        return (
          <View style={styles.freeDay}>
            <Text style={styles.freeDayTitle}>{item.isPast ? 'No occasions.' : 'Free day.'}</Text>
            <Text style={styles.freeDayText}>
              {item.isPast
                ? 'Log what you wore so your stylist learns from it.'
                : weekend ? 'Nothing on the calendar. Want a weekend look?' : `Nothing on the calendar for ${weekday}.`}
            </Text>
            <View style={styles.dayEmptyActions}>
              {item.isPast ? (
                <TouchableOpacity
                  style={[styles.dayEmptyBtn, styles.dayEmptyBtnPrimary]}
                  onPress={() => handleLogWear(item.date)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="What did you wear on this day"
                >
                  <Ionicons name="shirt-outline" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.dayEmptyBtnText, styles.dayEmptyBtnTextPrimary]}>What did you wear?</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.dayEmptyBtn, styles.dayEmptyBtnPrimary]}
                  onPress={() => openStylistForFreeDay(item.date)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={weekend ? 'Style a weekend look' : `Plan a look for ${weekday}`}
                >
                  <Ionicons name="sparkles-outline" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.dayEmptyBtnText, styles.dayEmptyBtnTextPrimary]}>
                    {weekend ? 'Style a weekend look' : `Plan ${weekday}'s look`}
                  </Text>
                </TouchableOpacity>
              )}
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
              {!item.isPast && item.date === todayStr ? (
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
              ) : null}
            </View>
          </View>
        );
      }
      case 'hero':
        return (
          <NextEventHero
            event={item.event}
            allItems={allItems}
            outfit={outfitFor(item.event)}
            weatherFallback={activeLocation}
            onPress={() => setDetailEvent(item.event)}
            onPlanOutfit={() => planFromAgenda(item.event, 'calendar_hero')}
            onOpenOutfit={() => openAssignedOutfit(item.event)}
            onWear={() => handleWear(item.event)}
            worn={isWorn(item.event)}
            isWearing={wearingEventId === item.event.id}
            isPlanning={false}
          />
        );
      case 'all-day':
      case 'event': {
        const Row = item.kind === 'all-day' ? AllDayBanner : AgendaEventRow;
        return (
          <Row
            event={item.event}
            allItems={allItems}
            outfit={outfitFor(item.event)}
            onPress={() => setDetailEvent(item.event)}
            onOpenOutfit={() => openAssignedOutfit(item.event)}
            onPlan={() => planFromAgenda(item.event, 'calendar_card')}
            past={item.date < todayStr}
            wornItemIds={item.date <= todayStr ? wornItemIdsFor(item.event) : null}
          />
        );
      }
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.stripArea, { paddingTop: insets.top }]}>
        <WeekStrip
          weekDays={weekDays}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          onPrevWeek={() => setWeekOffset((offset) => offset - 1)}
          onNextWeek={() => setWeekOffset((offset) => offset + 1)}
          onToday={() => handleSelectDate(toDateStr(new Date()))}
          planningStatus={planningStatus}
          weekOffset={weekOffset}
          expanded={calendarExpanded}
          monthOffset={monthOffset}
          onToggleExpanded={() => {
            setCalendarExpanded((value) => !value);
            if (calendarExpanded) setMonthOffset(0);
          }}
          onChangeMonthOffset={(delta) => setMonthOffset((value) => value + delta)}
          onAddEvent={handleAddEvent}
          onMore={openCalendarUtilities}
          dayThumbs={dayThumbs}
        />
        {trips.length > 0 ? (
          <UpcomingTripsRow
            trips={tripShelf}
            pastCount={tripArchive.length}
            today={tripsToday}
            onOpen={(trip) => { track('trip_opened', { source: 'calendar_trips' }); setOpenTripId(trip.id); }}
            onPlan={() => planTrip('calendar_trips')}
            onPast={() => setPastTripsVisible(true)}
          />
        ) : null}
      </View>
      <View style={styles.listArea}>
        <FlashList
          ref={flashListRef}
          data={timelineItems}
          renderItem={renderTimelineItem}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          // Explicit date jumps own the scroll position; automatic anchoring
          // can counteract them as rows load.
          maintainVisibleContentPosition={{ disabled: true }}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xxxl * 2 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          onScrollBeginDrag={() => { programmaticScroll.current = false; }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onEndReached={() => {
            if (agenda.laterCount > 0) setFutureDayCount((count) => count + FUTURE_PAGE);
          }}
          onEndReachedThreshold={1}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
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
        tripAction={tripActionFor(detailEvent)}
        weatherFallback={activeLocation}
        onWear={handleWear}
        worn={detailEvent ? isWorn(detailEvent) : false}
        isWearing={detailEvent != null && wearingEventId === detailEvent.id}
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
          { label: 'Log wear', icon: 'shirt-outline', onPress: () => handleLogWear(selectedDate) },
          { label: 'Plan a trip', icon: 'airplane-outline', onPress: () => planTrip('calendar_menu') },
          { label: 'Calendars & sync', icon: 'calendar-outline', onPress: () => setSyncVisible(true) },
        ]}
        onClose={() => setCalendarMenuVisible(false)}
      />
      <ActionMenuSheet
        visible={pastTripsVisible}
        deferSelectionUntilDismissed
        compact
        title="Past trips"
        options={tripArchive.map((trip) => ({
          label: trip.destination,
          subtitle: `${tripSpanLabel(trip.startDate, trip.endDate)?.range ?? trip.startDate} · ${trip.looks} ${trip.looks === 1 ? 'look' : 'looks'}`,
          icon: 'briefcase-outline',
          onPress: () => setOpenTripId(trip.id),
        }))}
        onClose={() => setPastTripsVisible(false)}
      />
      <TripDetailModal
        tripId={openTripId}
        onClose={() => setOpenTripId(null)}
        onAsk={openTrip?.conversationId != null ? (draft) => {
          const conversationId = openTrip.conversationId!;
          setOpenTripId(null);
          // Let the trip modal finish dismissing; iOS won't present a second modal mid-dismissal.
          setTimeout(() => openStylist({ source: 'calendar_card', conversationId, draft }), 400);
        } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.page },

  stripArea: {
    paddingHorizontal: spacing.page,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    zIndex: 1,
  },
  listArea: { flex: 1, overflow: 'hidden' },
  dayHeading: {
    ...typography.text.label,
    color: colors.mutedForeground,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  dayHeadingToday: { color: colors.accentInk },
  earlier: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: 44, marginTop: spacing.sm,
  },
  earlierText: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  freeDay: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  noUpcoming: { marginTop: spacing.lg },
  freeDayTitle: { ...typography.text.editorialSection, color: colors.foreground },
  freeDayText: { ...typography.text.bodySmall, color: colors.mutedForeground, marginBottom: spacing.sm },
  dayEmptyActions: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: spacing.sm,
  },
  dayEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full, backgroundColor: colors.surfaceSelected,
  },
  dayEmptyBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },
  dayEmptyBtnPrimary: { backgroundColor: colors.primary },
  dayEmptyBtnTextPrimary: { color: colors.primaryForeground },
  emptyLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  emptyLinkText: { ...typography.text.label, color: colors.foreground, textDecorationLine: 'underline' },

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
