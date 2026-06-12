import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { ScrollView as ScrollViewType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toDateStr } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';

export function WeekStrip({
  weekDays,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onToday,
  eventDateSet,
  weekOffset,
}: {
  weekDays: Date[];
  selectedDate: string | null;
  onSelectDate: (s: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  eventDateSet: Set<string>;
  weekOffset: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<ScrollViewType>(null);
  const todayStr = toDateStr(new Date());

  const first = weekDays[0];
  const last = weekDays[6];
  const weekLabel =
    first.getMonth() === last.getMonth()
      ? first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `${first.toLocaleDateString('en-US', { month: 'short' })} – ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  const baseYear = first.getFullYear();
  const baseMonth = first.getMonth();
  const displayRef = new Date(baseYear, baseMonth + monthOffset, 1);
  const displayYear = displayRef.getFullYear();
  const displayMonth = displayRef.getMonth();
  const displayMonthLabel = displayRef.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

  const handleToggle = () => {
    if (expanded) setMonthOffset(0);
    setExpanded((v) => !v);
  };

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (containerWidth === 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
    if (page === 0) setMonthOffset((o) => o - 1);
    else if (page === 2) setMonthOffset((o) => o + 1);
  };

  const renderDay = (d: Date, compact: boolean) => {
    const str = toDateStr(d);
    const isSel = str === selectedDate;
    const isToday = str === todayStr;
    const hasEvent = eventDateSet.has(str);
    return (
      <TouchableOpacity
        key={str}
        style={[
          compact ? s.compactBtn : s.dayBtn,
          isSel && s.dayBtnSel,
          !isSel && isToday && s.dayBtnToday,
        ]}
        onPress={() => onSelectDate(str)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        accessibilityState={{ selected: isSel }}
      >
        {!compact && (
          <Text style={[s.dayAbbrev, isSel && s.dayTextSel, !isSel && isToday && s.dayTextToday]}>
            {d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)}
          </Text>
        )}
        <Text style={[compact ? s.compactNum : s.dayNum, isSel && s.dayTextSel, !isSel && isToday && s.dayTextToday]}>
          {d.getDate()}
        </Text>
        <View style={[s.dot, hasEvent && (isSel ? s.dotSel : s.dotVis)]} />
      </TouchableOpacity>
    );
  };

  const renderGrid = (rows: (Date | null)[][]) => (
    <View style={{ width: containerWidth }}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.monthRow}>
          {row.map((d, ci) => (
            <View key={ci} style={s.monthCell}>
              {d ? renderDay(d, true) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.monthLabel}>{expanded ? displayMonthLabel : weekLabel}</Text>
        <View style={s.navRow}>
          {weekOffset !== 0 && !expanded && (
            <TouchableOpacity onPress={onToday} style={s.todayBtn} accessibilityRole="button" accessibilityLabel="Return to today">
              <Text style={s.todayText}>Today</Text>
            </TouchableOpacity>
          )}
          {!expanded && (
            <>
              <TouchableOpacity onPress={onPrevWeek} style={s.navBtn} accessibilityRole="button" accessibilityLabel="Previous week">
                <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onNextWeek} style={s.navBtn} accessibilityRole="button" accessibilityLabel="Next week">
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
          {expanded && (
            <>
              <TouchableOpacity onPress={() => setMonthOffset((o) => o - 1)} style={s.navBtn} accessibilityRole="button" accessibilityLabel="Previous month">
                <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMonthOffset((o) => o + 1)} style={s.navBtn} accessibilityRole="button" accessibilityLabel="Next month">
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={handleToggle} style={s.navBtn} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse month calendar' : 'Expand month calendar'}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {!expanded && (
        <View style={s.days}>
          {weekDays.map((d) => renderDay(d, false))}
        </View>
      )}

      {expanded && (
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <View style={s.colHeaders}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((h) => (
              <Text key={h} style={s.colHeader}>{h}</Text>
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
            >
              {renderGrid(prevRows)}
              {renderGrid(currRows)}
              {renderGrid(nextRows)}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginBottom: spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  navRow: { flexDirection: 'row', alignItems: 'center' },
  todayBtn: {
    minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  todayText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  navBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs + 2, borderRadius: radii.md, gap: 1 },
  dayBtnSel: { backgroundColor: colors.primary },
  dayBtnToday: {},
  dayAbbrev: { fontSize: 10, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3 },
  dayNum: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.mutedForeground },
  dayTextSel: { color: colors.white },
  dayTextToday: { color: colors.primary },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  dotVis: { backgroundColor: colors.primary },
  dotSel: { backgroundColor: 'rgba(255,255,255,0.7)' },
  colHeaders: { flexDirection: 'row', marginBottom: 4 },
  colHeader: {
    flex: 1, textAlign: 'center',
    fontSize: 10, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, opacity: 0.5,
    textTransform: 'uppercase', letterSpacing: 0.3,
    paddingVertical: spacing.xs,
  },
  monthRow: { flexDirection: 'row', marginBottom: 2 },
  monthCell: { flex: 1, alignItems: 'center' },
  compactBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.md, gap: 1,
  },
  compactNum: {
    fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
});
