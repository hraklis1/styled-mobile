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

function longDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Home's wear diary at a glance: the last seven days, today on the right, one
 * column per day. A filled tile is a logged day; every empty tile can be
 * tapped to log it, today's marked as the obvious one. It reads as a week even
 * when the user hasn't logged in a while, which a rail of past entries never
 * could.
 */
export function WearWeekStrip({ logs, items, onLogToday, onLogDay, onOpenEntry, disabled }: Props) {
  const { width } = useWindowDimensions();
  const week = useMemo(() => buildWearWeek(logs), [logs]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const tileWidth = Math.floor((width - spacing.page * 2 - COLUMN_GAP * 6) / 7);
  const tileHeight = Math.round(tileWidth / editorial.garmentAspectRatio);


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
      // Quiet neutral slots keep the emphasis on the clothes and today.
      <View style={[styles.slot, { width: tileWidth, height: tileHeight }]} />
    );

    return (
      <View key={day.dateKey} style={[styles.column, { width: tileWidth }]}>
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
        {/* One stacked dateline under each tile — weekday over a serif
            numeral — rather than letters above and digits below. */}
        <View style={styles.dateline}>
          <Text style={[styles.weekday, day.isToday && styles.todayInk]}>
            {day.isToday ? 'Today' : day.date.toLocaleDateString('en-US', { weekday: 'short' })}
          </Text>
          <Text style={[styles.dayNumber, day.isToday && styles.todayInk]}>{day.date.getDate()}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>{week.days.map(renderDay)}</View>
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
    <View style={[styles.slot, { width, height }]}>
      <Animated.View style={[styles.todayDisc, breath]}>
        <Ionicons name="add" size={16} color={colors.primaryForeground} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { alignItems: 'center', gap: spacing.xs },
  dateline: { alignItems: 'center', gap: 1, marginTop: 2 },
  weekday: {
    ...typography.text.masthead,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: colors.mutedForeground,
  },
  tilePressable: { borderRadius: radii.photo },
  loggedPlate: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    backgroundColor: surfaces.plate,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    backgroundColor: colors.linen,
  },
  slotPressed: { backgroundColor: colors.surfaceSubtle },
  // A solid ink disc on the open tile: the one control-like mark in the row.
  todayDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foreground,
  },
  dayNumber: {
    ...typography.text.editorialCard,
    fontVariant: ['tabular-nums'],
    color: colors.inkSubtle,
  },
  todayInk: { color: colors.foreground },
});
