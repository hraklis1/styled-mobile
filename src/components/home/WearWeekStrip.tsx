import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GarmentImage } from '../wardrobe/garment-image';
import { PressableScale } from '../primitives/PressableScale';
import { buildWearWeek, type WearWeekDay } from '../../lib/wearWeek';
import { colors, editorial, radii, spacing, typography } from '../../theme';
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
 * could, and the summary invites rather than reports how long it's been.
 */
export function WearWeekStrip({ logs, items, onLogToday, onLogDay, onOpenEntry, disabled }: Props) {
  const { width } = useWindowDimensions();
  const week = useMemo(() => buildWearWeek(logs), [logs]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const tileWidth = Math.floor((width - spacing.page * 2 - COLUMN_GAP * 6) / 7);
  const tileHeight = Math.round(tileWidth / editorial.garmentAspectRatio);

  const summary = week.loggedCount > 0
    ? `${week.loggedCount} of the last 7 days logged`
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
      firstItem ? (
        <GarmentImage item={firstItem} width={tileWidth} height={tileHeight} borderRadius={radii.sm} placeholderIconSize={14} />
      ) : (
        <View style={[styles.plate, { width: tileWidth, height: tileHeight }]}>
          <Ionicons name="shirt-outline" size={14} color={colors.mutedForeground} />
        </View>
      )
    ) : (
      <View
        style={[
          styles.plate,
          { width: tileWidth, height: tileHeight },
          day.isToday && styles.todayPlate,
        ]}
      >
        {day.isToday ? <Ionicons name="add" size={18} color={colors.accentInk} /> : null}
      </View>
    );

    return (
      <View key={day.dateKey} style={[styles.column, { width: tileWidth }]}>
        <Text style={[styles.weekday, day.isToday && styles.todayText]}>
          {day.date.toLocaleDateString('en-US', { weekday: 'narrow' })}
        </Text>
        <PressableScale
          contentStyle={styles.tilePressable}
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

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { alignItems: 'center', gap: spacing.xs },
  weekday: {
    ...typography.text.eyebrow,
    color: colors.mutedForeground,
  },
  tilePressable: { borderRadius: radii.sm },
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  todayPlate: {
    backgroundColor: 'transparent',
    borderWidth: 1,
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
    ...typography.text.meta,
    color: colors.mutedForeground,
  },
});
