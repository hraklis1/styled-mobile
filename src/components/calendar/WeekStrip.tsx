import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { ScrollView as ScrollViewType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { toDateStr } from './calendarUtils';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, spacing, typography, radii, motion } from '../../theme';
import { PressableScale } from '../primitives/PressableScale';
import { Image } from 'expo-image';
import { IconButton } from '../primitives/Editorial';
import * as Haptics from '../../lib/haptics';
import type { DayPlanningStatus } from './calendarAgenda';
import { tripDayLabel, tripOnDate } from './tripDays';
import type { TripSummary } from '../../features/trips/types';

const MONTH_ROW_HEIGHT = 48;
const THUMB = 36;
// Walnut at reduced strength: a grid full of open days should read as quiet.
const NEEDS_RING = 'rgba(111,89,72,0.42)';

const TRIP_INSET = 10;
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PILL_SPRING = { damping: 20, stiffness: 220 };

const REVEAL_EASING = Easing.bezier(0.2, 0, 0, 1);
export const STRIP_LAYOUT = LinearTransition.duration(motion.base).easing(REVEAL_EASING);

export function WeekStrip({
  weekDays,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onToday,
  planningStatus,
  expanded,
  monthOffset,
  onToggleExpanded,
  onChangeMonthOffset,
  onAddEvent,
  onMore,
  dayThumbs,
  trips = [],
  onOpenTrip,
}: {
  weekDays: Date[];
  selectedDate: string | null;
  onSelectDate: (s: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  planningStatus: Map<string, DayPlanningStatus>;
  weekOffset: number;
  expanded: boolean;
  monthOffset: number;
  onToggleExpanded: () => void;
  onChangeMonthOffset: (delta: number) => void;
  onAddEvent: () => void;
  onMore: () => void;
  /** Lead-piece image for days with a planned look (month grid only). */
  dayThumbs?: Map<string, string>;
  /** Trips draw as a span under their dates instead of cards in the agenda. */
  trips?: TripSummary[];
  onOpenTrip?: (tripId: number) => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [daysWidth, setDaysWidth] = useState(0);
  const scrollRef = useRef<ScrollViewType>(null);
  const reducedMotion = useReducedMotion();
  const todayStr = toDateStr(new Date());

  const first = weekDays[0];
  const last = weekDays[6];
  // The month is the page title. A week spanning two months names both.
  const weekMonth = first.getMonth() === last.getMonth()
    ? first.toLocaleDateString('en-US', { month: 'long' })
    : `${first.toLocaleDateString('en-US', { month: 'short' })} – ${last.toLocaleDateString('en-US', { month: 'short' })}`;
  const weekYear = String(last.getFullYear());

  // The selection pill slides between days instead of jumping.
  const selectedIndex = weekDays.findIndex((d) => toDateStr(d) === selectedDate);
  const cellWidth = daysWidth / 7;
  const pillX = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const weekKey = toDateStr(first);
  const pillWeek = useRef(weekKey);
  useEffect(() => {
    if (cellWidth === 0) return;
    const visible = selectedIndex >= 0;
    // Arriving from another week, place it rather than sweeping across.
    const sameWeek = pillWeek.current === weekKey;
    pillWeek.current = weekKey;
    if (visible) {
      const x = selectedIndex * cellWidth;
      pillX.value = reducedMotion || !sameWeek || pillOpacity.value === 0 ? x : withSpring(x, PILL_SPRING);
    }
    pillOpacity.value = reducedMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: motion.quick });
  }, [selectedIndex, weekKey, cellWidth, reducedMotion, pillX, pillOpacity]);
  // The chevron turns rather than swapping glyphs, in step with the reveal.
  const chevronTurn = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    chevronTurn.value = reducedMotion ? (expanded ? 1 : 0) : withTiming(expanded ? 1 : 0, { duration: motion.base, easing: REVEAL_EASING });
  }, [expanded, reducedMotion, chevronTurn]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevronTurn.value * 180}deg` }] }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ translateX: pillX.value }],
  }));

  const baseYear = first.getFullYear();
  const baseMonth = first.getMonth();
  const displayRef = new Date(baseYear, baseMonth + monthOffset, 1);
  const displayYear = displayRef.getFullYear();
  const displayMonth = displayRef.getMonth();
  const displayMonthName = displayRef.toLocaleDateString('en-US', { month: 'long' });
  const titleMonth = expanded ? displayMonthName : weekMonth;
  const titleYear = expanded ? String(displayYear) : weekYear;
  const todayVisible = selectedDate === todayStr && (expanded ? monthOffset === 0 && displayMonth === new Date().getMonth() : selectedIndex >= 0);

  const buildRows = (year: number, month: number): (Date | null)[][] => {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startPad = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  };

  const [prevRows, currRows, nextRows] = useMemo(() => {
    const prevD = new Date(displayYear, displayMonth - 1, 1);
    const nextD = new Date(displayYear, displayMonth + 1, 1);
    return [
      buildRows(prevD.getFullYear(), prevD.getMonth()),
      buildRows(displayYear, displayMonth),
      buildRows(nextD.getFullYear(), nextD.getMonth()),
    ];
  }, [displayYear, displayMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (expanded && containerWidth > 0) {
      scrollRef.current?.scrollTo({ x: containerWidth, animated: false });
    }
  }, [monthOffset, containerWidth, expanded]);

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (containerWidth === 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
    if (page === 1) return;
    void Haptics.selectionAsync();
    onChangeMonthOffset(page === 0 ? -1 : 1);
  };

  const weekGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-24, 24])
      .activeOffsetY([-14, 14])
      .onEnd(({ translationX, translationY, velocityX, velocityY }) => {
        // Sideways pages the week; pulling down opens the month.
        if (Math.abs(translationY) > Math.abs(translationX)) {
          if (translationY > 32 || velocityY > 480) scheduleOnRN(onToggleExpanded);
          return;
        }
        const intent = Math.abs(translationX) > 48 || Math.abs(velocityX) > 480;
        if (!intent) return;
        if (translationX < 0) scheduleOnRN(onNextWeek);
        else scheduleOnRN(onPrevWeek);
      }),
    [onNextWeek, onPrevWeek, onToggleExpanded],
  );

  // Contiguous runs of this week's days that one trip covers.
  const tripSegments = useMemo(() => {
    const segments: { trip: TripSummary; start: number; end: number }[] = [];
    weekDays.forEach((d, index) => {
      const trip = tripOnDate(trips, toDateStr(d));
      const last = segments[segments.length - 1];
      if (!trip) return;
      if (last && last.trip.id === trip.id && last.end === index - 1) last.end = index;
      else segments.push({ trip, start: index, end: index });
    });
    return segments;
  }, [weekDays, trips]);

  // Swiping up on the month folds it back to the week.
  const monthGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-14, 14])
      .failOffsetX([-14, 14])
      .onEnd(({ translationY, velocityY }) => {
        if (translationY < -32 || velocityY < -480) scheduleOnRN(onToggleExpanded);
      }),
    [onToggleExpanded],
  );

  const selectDay = (str: string) => {
    if (str !== selectedDate) void Haptics.selectionAsync();
    onSelectDate(str);
  };

  const dayLabel = (d: Date, str: string) => {
    const status = planningStatus.get(str);
    const statusLabel = status === 'needs' ? ', needs a look' : status === 'planned' ? ', looks planned' : ', no events';
    const trip = tripOnDate(trips, str);
    return `${str === todayStr ? 'Today, ' : ''}${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${statusLabel}${trip ? `, ${tripDayLabel(trip, str)}` : ''}`;
  };

  const renderDay = (d: Date) => {
    const str = toDateStr(d);
    const isSel = str === selectedDate;
    const isToday = str === todayStr;
    const status = planningStatus.get(str);
    return (
      <PressableScale
        key={str}
        style={s.dayOuter}
        contentStyle={s.dayBtn}
        onPress={() => selectDay(str)}
        scaleTo={0.94}
        haptic={false}
        accessibilityRole="button"
        accessibilityLabel={dayLabel(d, str)}
        accessibilityHint="Show this date in the agenda"
        accessibilityState={{ selected: isSel }}
      >
        <Text style={[s.dayAbbrev, isSel && s.dayTextSel, !isSel && isToday && s.dayTextToday]}>
          {WEEKDAY_LETTERS[(d.getDay() + 6) % 7]}
        </Text>
        <View>
          <Text style={[s.dayNum, isSel && s.dayTextSel, !isSel && isToday && s.dayTextToday]}>
            {d.getDate()}
          </Text>
          <View style={[s.todayRule, (!isToday || isSel) && s.hidden]} />
        </View>
        <View
          style={[
            s.dot,
            status === 'planned' && (isSel ? s.dotFilledSel : s.dotFilled),
            status === 'needs' && (isSel ? s.dotHollowSel : s.dotHollow),
            !status && s.hidden,
          ]}
        />
      </PressableScale>
    );
  };

  // The month grid reads as a lookbook: planned days show their look, days
  // that still need one carry a walnut ring, everything else is a number.
  const renderMonthDay = (d: Date) => {
    const str = toDateStr(d);
    const isSel = str === selectedDate;
    const isToday = str === todayStr;
    const status = planningStatus.get(str);
    const thumb = dayThumbs?.get(str);
    return (
      <PressableScale
        key={str}
        style={s.compactOuter}
        contentStyle={s.compactBtn}
        onPress={() => selectDay(str)}
        scaleTo={0.94}
        haptic={false}
        accessibilityRole="button"
        accessibilityLabel={dayLabel(d, str)}
        accessibilityHint="Show this date in the agenda"
        accessibilityState={{ selected: isSel }}
      >
        {thumb ? (
          <View style={[s.thumbWrap, status === 'needs' && s.thumbWrapNeeds, isSel && s.thumbWrapSel]}>
            <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" recyclingKey={str} transition={120} />
            <View style={[s.thumbBadge, isToday && s.thumbBadgeToday]}>
              <Text style={[s.thumbBadgeText, isToday && s.thumbBadgeTextToday]}>{d.getDate()}</Text>
            </View>
          </View>
        ) : (
          <View
            style={[
              s.monthCircle,
              status === 'needs' && s.monthCircleNeeds,
              status === 'planned' && s.monthCirclePlanned,
              isSel && s.monthCircleSel,
            ]}
          >
            <Text style={[s.compactNum, isSel && s.dayTextSel, !isSel && isToday && s.dayTextToday]}>
              {d.getDate()}
            </Text>
          </View>
        )}
      </PressableScale>
    );
  };

  // The month grid carries the same span as a thin rule under the days.
  const renderMonthTrip = (d: Date) => {
    const str = toDateStr(d);
    const trip = tripOnDate(trips, str);
    if (!trip) return null;
    return (
      <View
        pointerEvents="none"
        style={[s.monthTrip, str === trip.startDate && s.monthTripStart, str === trip.endDate && s.monthTripEnd]}
      />
    );
  };

  const renderGrid = (rows: (Date | null)[][], isCurrent: boolean) => (
    <View
      style={{ width: containerWidth }}
      accessibilityElementsHidden={!isCurrent}
      importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
    >
      {rows.map((row, ri) => (
        <View key={ri} style={s.monthRow}>
          {row.map((d, ci) => (
            <View key={ci} style={s.monthCell}>
              {d ? renderMonthTrip(d) : null}
              {d ? renderMonthDay(d) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  // Expanding cross-fades week and month while the strip's height eases to fit.
  const revealIn = reducedMotion ? undefined : FadeIn.duration(motion.base).delay(motion.quick / 2).easing(REVEAL_EASING);
  const revealOut = reducedMotion ? undefined : FadeOut.duration(motion.quick).easing(REVEAL_EASING);
  return (
    <Animated.View style={s.root} layout={reducedMotion ? undefined : STRIP_LAYOUT}>
      <View style={s.header}>
        <PressableScale
          style={s.monthButtonOuter}
          contentStyle={s.monthButton}
          onPress={onToggleExpanded}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} month calendar, ${titleMonth} ${titleYear}`}
          accessibilityState={{ expanded }}
        >
          <Text style={s.monthTitle} numberOfLines={1}>{titleMonth}</Text>
          <Text style={s.yearLabel}>{titleYear}</Text>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
          </Animated.View>
        </PressableScale>
        <View style={s.navRow}>
          {!todayVisible && (
            <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(motion.quick)} exiting={reducedMotion ? undefined : FadeOut.duration(motion.quick)}>
              <TouchableOpacity onPress={onToday} style={s.todayBtn} accessibilityRole="button" accessibilityLabel="Show today’s events">
                <Text style={s.todayText}>Today</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          <IconButton label="Add event" icon="add" onPress={onAddEvent} />
          <IconButton label="More" accessibilityLabel="More calendar tools" icon="ellipsis-horizontal" onPress={onMore} />
        </View>
      </View>

      {!expanded && (
        <Animated.View entering={revealIn} exiting={revealOut}>
        <GestureDetector gesture={weekGesture}>
          <View style={s.days} onLayout={(e) => setDaysWidth(e.nativeEvent.layout.width)}>
            {cellWidth > 0 && (
              <Animated.View pointerEvents="none" style={[s.pill, { width: cellWidth }, pillStyle]} />
            )}
            {weekDays.map((d) => renderDay(d))}
          </View>
        </GestureDetector>
        {tripSegments.length > 0 && cellWidth > 0 && (
        <View style={s.tripRow}>
          {tripSegments.map(({ trip, start, end }) => {
            const opens = toDateStr(weekDays[start]) === trip.startDate;
            const closes = toDateStr(weekDays[end]) === trip.endDate;
            // An open end runs to the strip's edge so the trip reads as continuing.
            const left = start * cellWidth + (opens ? TRIP_INSET : 0);
            const width = (end - start + 1) * cellWidth - (opens ? TRIP_INSET : 0) - (closes ? TRIP_INSET : 0);
            return (
              <View key={trip.id} style={[s.tripSegment, { left, width }]}>
                <View style={[s.tripBar, opens && s.tripBarStart, closes && s.tripBarEnd]} />
                <TouchableOpacity
                  onPress={() => onOpenTrip?.(trip.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Trip to ${trip.destination}. Open trip`}
                >
                  <Text style={s.tripLabel} numberOfLines={1}>{trip.destination}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        )}
        </Animated.View>
      )}

      {expanded && (
        <Animated.View entering={revealIn} exiting={revealOut}>
        <GestureDetector gesture={monthGesture}>
          <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
          <View style={s.colHeaders}>
            {WEEKDAY_LETTERS.map((h, index) => (
              <Text key={index} style={s.colHeader}>{h}</Text>
            ))}
          </View>
          {containerWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleScrollEnd}
              directionalLockEnabled
              // Sized to this month's rows so a five-week month leaves no gap.
              style={{ height: currRows.length * MONTH_ROW_HEIGHT }}
            >
              {renderGrid(prevRows, false)}
              {renderGrid(currRows, true)}
              {renderGrid(nextRows, false)}
            </ScrollView>
          )}
        </View>
        </GestureDetector>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: spacing.sm,
  },
  monthButtonOuter: { flex: 1, minWidth: 0 },
  monthButton: { minHeight: 44, minWidth: 0, flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  monthTitle: { ...typography.text.editorialTitle, color: colors.foreground, flexShrink: 1 },
  yearLabel: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  todayBtn: {
    minHeight: 36, justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ghostStroke,
  },
  todayText: { ...typography.text.label, color: colors.accentInk },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  pill: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    borderRadius: radii.action,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  dayOuter: { flex: 1 },
  dayBtn: {
    minHeight: 62,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.action, gap: 3,
    borderCurve: 'continuous',
  },
  dayAbbrev: {
    ...typography.text.caption, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, letterSpacing: typography.tracking.meta,
  },
  dayNum: { fontSize: 15, fontWeight: typography.weight.semibold, color: colors.foreground, textAlign: 'center' },
  dayTextSel: { color: colors.primaryForeground },
  dayTextToday: { color: colors.accentInk },
  todayRule: { height: 2, borderRadius: 1, marginTop: 1, backgroundColor: colors.accentInk },
  hidden: { opacity: 0 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotFilled: { backgroundColor: colors.primary },
  dotFilledSel: { backgroundColor: colors.primaryForeground },
  dotHollow: { borderWidth: 1, borderColor: colors.accentInk },
  dotHollowSel: { borderWidth: 1, borderColor: colors.primaryForeground },
  tripRow: { height: 22, marginTop: spacing.xs },
  tripSegment: { position: 'absolute', top: 0, gap: 3 },
  tripBar: { height: 3, backgroundColor: colors.accentInk, opacity: 0.55 },
  tripBarStart: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  tripBarEnd: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  tripLabel: { ...typography.text.caption, fontWeight: typography.weight.semibold, color: colors.accentInk },
  monthTrip: { position: 'absolute', left: 0, right: 0, bottom: 2, height: 3, backgroundColor: colors.accentInk, opacity: 0.45 },
  monthTripStart: { left: '22%', borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  monthTripEnd: { right: '22%', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  colHeaders: { flexDirection: 'row', marginBottom: 4 },
  colHeader: {
    flex: 1, textAlign: 'center',
    ...typography.text.caption, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    letterSpacing: typography.tracking.meta,
    paddingVertical: spacing.xs,
  },
  monthRow: { flexDirection: 'row', height: MONTH_ROW_HEIGHT, alignItems: 'center' },
  monthCell: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  compactOuter: { width: '100%' },
  compactBtn: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  monthCircle: {
    width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  monthCircleNeeds: { borderWidth: 1, borderColor: NEEDS_RING },
  monthCirclePlanned: { backgroundColor: colors.surfaceSelected },
  monthCircleSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  thumbWrap: { width: THUMB, height: THUMB },
  thumbWrapNeeds: { borderRadius: THUMB / 2, outlineWidth: 1, outlineColor: NEEDS_RING, outlineOffset: 2 },
  thumbWrapSel: { borderRadius: THUMB / 2, outlineWidth: 2, outlineColor: colors.primary, outlineOffset: 2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.imageMat },
  thumbBadge: {
    position: 'absolute', right: -5, bottom: -3,
    minWidth: 18, height: 16, paddingHorizontal: 3, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  thumbBadgeToday: { backgroundColor: colors.accentInk, borderColor: colors.accentInk },
  thumbBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: typography.weight.semibold, color: colors.foreground },
  thumbBadgeTextToday: { color: colors.primaryForeground },
  compactNum: {
    fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold,
    color: colors.foreground, textAlign: 'center',
  },
});
