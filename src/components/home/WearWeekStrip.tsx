import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GarmentImage } from '../wardrobe/garment-image';
import { PressableScale } from '../primitives/PressableScale';
import { buildWearWeek, type WearWeekDay } from '../../lib/wearWeek';
import { colors, editorial, radii, spacing, stroke, surfaces, typography } from '../../theme';
import type { OutfitLog } from '../../hooks/useOutfitLogs';
import type { Item } from '../../types/item';

const COLUMN_GAP = 6;

type Props = {
  logs: OutfitLog[];
  items: Item[];
  /** Today with no entry yet. */
  onLogToday: () => void;
  /** A past day with no entry. */
  onLogDay: (dateKey: string) => void;
  onOpenEntry: (log: OutfitLog) => void;
  disabled?: boolean;
};

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

function longDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Home's wear diary at a glance: the last seven days, today on the right, one
 * column per day. A filled tile is a logged day; every empty tile can be
 * tapped to log it, today's marked as the obvious one. It reads as a week even
 * when the user hasn't logged in a while, which a rail of past entries never
 * could, and the summary invites rather than reports how long it's been.
 */
export function WearWeekStrip({ logs, items, onLogToday, onLogDay, onOpenEntry, disabled }: Props) {
  const { width } = useWindowDimensions();
  const week = useMemo(() => buildWearWeek(logs), [logs]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const tileWidth = Math.floor((width - spacing.page * 2 - COLUMN_GAP * 6) / 7);
  const tileHeight = Math.round(tileWidth / editorial.garmentAspectRatio);

  const summary = week.loggedCount > 0
    ? `${COUNT_WORDS[week.loggedCount] ?? week.loggedCount} of the last seven days logged`
    : week.lastLog
      ? 'Tap today to log what you’re wearing'
      : 'Start your wear diary — tap today';

  const renderDay = (day: WearWeekDay) => {
    const firstItem = day.log
      ? day.log.itemIds.map((id) => itemsById.get(id)).find((item): item is Item => !!item)
      : undefined;
    const pieceCount = day.log?.itemIds.filter((id) => itemsById.has(id)).length ?? 0;
    const label = day.log
      ? `${longDay(day.date)}, ${pieceCount} piece${pieceCount === 1 ? '' : 's'}. Open entry options`
      : `${day.isToday ? 'Today, ' : ''}${longDay(day.date)}, not logged. Tap to log`;

    const onPress = day.log
      ? () => onOpenEntry(day.log!)
      : day.isToday
        ? onLogToday
        : () => onLogDay(day.dateKey);

    const tile = day.log ? (
      <View style={[styles.loggedPlate, { width: tileWidth, height: tileHeight }]}>
        {firstItem ? (
          <GarmentImage item={firstItem} width={tileWidth} height={tileHeight} borderRadius={radii.photo} placeholderIconSize={14} />
        ) : (
          <Ionicons name="shirt-outline" size={14} color={colors.mutedForeground} />
        )}
      </View>
    ) : day.isToday ? (
      <TodaySlot width={tileWidth} height={tileHeight} />
    ) : (
      // An empty day is a stitched outline waiting to be filled, not a grey block.
      <View style={[styles.slot, { width: tileWidth, height: tileHeight }]} />
    );

    return (
      <View key={day.dateKey} style={[styles.column, { width: tileWidth }]}>
        <Text style={[styles.weekday, day.isToday && styles.todayText]}>
          {day.date.toLocaleDateString('en-US', { weekday: 'narrow' })}
        </Text>
        <PressableScale
          contentStyle={styles.tilePressable}
          pressedContentStyle={!day.log ? styles.slotPressed : undefined}
          onPress={onPress}
          onLongPress={day.log ? () => onOpenEntry(day.log!) : undefined}
          disabled={disabled}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: !!disabled }}
        >
          {tile}
        </PressableScale>
        <Text style={[styles.dayNumber, day.isToday && styles.todayText]}>{day.date.getDate()}</Text>
        <View style={[styles.todayDot, !day.isToday && styles.hidden]} />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>{week.days.map(renderDay)}</View>
      <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
    </View>
  );
}

/**
 * Today's open slot. It breathes twice when the strip first appears, the one
 * cue on the page that says "this is the tile to tap", then settles.
 */
function TodaySlot({ width, height }: { width: number; height: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      2,
    );
  }, [opacity, reduceMotion]);
  const breath = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.slot, styles.todaySlot, { width, height }, breath]}>
      <Ionicons name="add" size={18} color={colors.accentInk} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { alignItems: 'center', gap: spacing.xs },
  weekday: {
    ...typography.text.masthead,
    letterSpacing: 1.6,
    color: colors.mutedForeground,
  },
  tilePressable: { borderRadius: radii.photo },
  loggedPlate: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    borderWidth: stroke.hairline,
    borderColor: colors.border,
    backgroundColor: surfaces.plate,
  },
  // Dashed at 1pt, not hairline: dashed hairlines render broken on iOS.
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
  },
  slotPressed: { backgroundColor: colors.surfaceSubtle },
  todaySlot: {
    borderStyle: 'solid',
    borderColor: colors.accentInk,
  },
  dayNumber: {
    ...typography.text.caption,
    fontVariant: ['tabular-nums'],
    color: colors.mutedForeground,
  },
  todayText: {
    color: colors.accentInk,
    fontWeight: typography.weight.semibold,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentInk,
  },
  hidden: { opacity: 0 },
  summary: {
    fontFamily: typography.family.editorialItalic,
    fontSize: 15,
    lineHeight: 20,
    color: colors.inkSubtle,
  },
});
