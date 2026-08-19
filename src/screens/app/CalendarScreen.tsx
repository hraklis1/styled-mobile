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
  | { kind: 'selected-heading'; key: string; label: string }
  | { kind: 'selected-empty'; key: string; date: string; isPast: boolean }
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
  const [pickerEvent, setPickerEvent] = useState<Event | null>(null);
  const [outfitPickerEvent, setOutfitPickerEvent] = useState<Event | null>(null);
  const [returnToDetailEventId, setReturnToDetailEventId] = useState<number | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [calendarMenuVisible, setCalendarMenuVisible] = useState(false);

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
      if (dayEvents.length === 0) {
        selected.push({
          kind: 'selected-empty',
          key: 'selected-empty',
          date: selectedDate,
          // ISO yyyy-mm-dd compares correctly as a string, which keeps the
          // per-render `dayStartMs` out of this memo's dependencies.
          isPast: selectedDate < toDateStr(new Date()),
        });
      }
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
    setSelectedDate((prev) => (prev === s ? null : s));
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

  const renderEventCard = (event: Event) => {
    const occasion = OCCASIONS.find((option) => option.id === event.occasion)?.label ?? event.occasion;
    const presentation = presentCalendarEvent(event);
    return (
      <View style={styles.eventCard}>
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
            <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} />
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
      case 'past-event': {
        const pastPresentation = presentCalendarEvent(item.event);
        return (
          <View style={styles.pastCard}>
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
                <ItemThumbStack itemIds={item.event.itemIds!} allItems={allItems} />
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

  header: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
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
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  sectionEyebrow: {
    ...typography.text.eyebrow,
    color: colors.primary,
    marginBottom: 2,
  },

  filterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  clearFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full, backgroundColor: colors.muted,
  },
  clearFilterText: { ...typography.text.label, fontWeight: typography.weight.medium, color: colors.mutedForeground },

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
    opacity: 0.72,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
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
  pastTitle: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
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
