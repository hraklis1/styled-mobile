import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventWeatherForecast, type WeatherCondition } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import { EventLookCollage } from './EventLookCollage';
import {
  OCCASIONS,
  formatDayLabel,
  formatCountdown,
  formatTime,
} from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';
import { getEventPlanActionLabel } from './calendarPlanning';
import { presentCalendarEvent } from './calendar-presentation';
import { PressableScale } from '../primitives/PressableScale';

const WEATHER_ICONS: Record<WeatherCondition, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold: 'snow-outline',
  mild: 'partly-sunny-outline',
};

export function NextEventHero({
  event,
  allItems,
  weatherFallback,
  onPress,
  onPlanOutfit,
  onOpenOutfit,
  isPlanning,
  outfit,
}: {
  event: Event;
  allItems: Item[];
  outfit: Outfit | null;
  weatherFallback: StylingLocationContext | null;
  onPress: () => void;
  onPlanOutfit: () => void;
  onOpenOutfit: () => void;
  isPlanning: boolean;
}) {
  const forecast = useEventWeatherForecast(
    event.location,
    weatherFallback,
    event.date.slice(0, 10),
  );
  const tempUnit = useTempUnit();

  const d = new Date(event.date);
  const dayLabel = formatDayLabel(d);
  const badge = formatCountdown(d) ?? (dayLabel === 'Today' || dayLabel === 'Tomorrow' ? dayLabel : null);
  const occasionMeta = OCCASIONS.find((o) => o.id === event.occasion);
  const presentation = presentCalendarEvent(event);
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.eventButton}
        onPress={onPress}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`Next event: ${event.title}`}
      >
        <View style={s.topRow}>
          <Text style={s.upNext}>Up next</Text>
          {badge ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.mainRow}>
          <View style={s.dateBlock}>
            <Text style={s.dateMonth}>{presentation.monthLabel}</Text>
            <Text style={s.dateDay}>{presentation.dayLabel}</Text>
          </View>
          <View style={s.body}>
            <Text style={s.title} numberOfLines={2}>{event.title}</Text>
            <Text style={s.meta}>
              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(d)}
            </Text>
          </View>
        </View>

        {occasionMeta || event.location || forecast.data ? (
          <View style={s.context}>
            <View style={[s.contextLine, !occasionMeta && s.contextLineSolo]}>
              {occasionMeta ? (
                <View style={s.detail}>
                  <Ionicons name="shirt-outline" size={13} color={colors.primary} />
                  <Text style={[s.detailText, s.detailTextAccent]}>{occasionMeta.label}</Text>
                </View>
              ) : null}
              {forecast.data ? (
                <View style={s.detail}>
                  <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={13} color={colors.mutedForeground} />
                  <Text style={s.detailText}>{formatTempRange(forecast.data, tempUnit)}</Text>
                </View>
              ) : null}
            </View>
            {event.location ? (
              <View style={s.locationLine}>
                <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                <Text style={s.detailText} numberOfLines={1}>{event.location}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>

      {hasOutfit ? (
        <PressableScale
          contentStyle={s.lookPreview}
          onPress={onOpenOutfit}
          accessibilityRole="button"
          accessibilityLabel={`${event.outfitId == null ? 'View details' : 'View outfit'} for ${event.title}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`}
        >
          <View style={s.lookCollage}>
            <EventLookCollage
              itemIds={event.itemIds ?? []}
              allItems={allItems}
              size={56}
              borderRadius={radii.lg}
              outfit={outfit}
            />
          </View>
          <View style={s.outfitCopy}>
            <Text style={s.outfitReady}>{event.outfitId == null ? 'Custom look' : 'Your look'}</Text>
            <Text style={s.outfitHint}>{pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}</Text>
          </View>
          <View style={s.viewLookPill}>
            <Text style={s.viewLookText}>{event.outfitId == null ? 'View details' : 'View outfit'}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </PressableScale>
      ) : (
        <View style={s.actionRow}>
          <View style={s.outfitStatus}>
            <View style={s.planIcon}>
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            </View>
            <View style={s.outfitCopy}>
              <Text style={s.outfitReady}>Ready to style</Text>
              <Text style={s.outfitHint}>Styled will build a look from your wardrobe</Text>
            </View>
          </View>
          <PressableScale
            contentStyle={[s.planBtn, isPlanning && s.planBtnDisabled]}
            onPress={onPlanOutfit}
            disabled={isPlanning}
            accessibilityRole="button"
            accessibilityLabel={isPlanning
              ? `Styling an outfit for ${event.title}`
              : `${getEventPlanActionLabel(false)} for ${event.title}`}
            accessibilityState={{ disabled: isPlanning, busy: isPlanning }}
          >
            {isPlanning ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="sparkles-outline" size={14} color={colors.white} />
            )}
            <Text style={s.planBtnText}>{isPlanning ? 'Styling…' : 'Ask Styled'}</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderCurve: 'continuous',
  },
  eventButton: { gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upNext: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateBlock: {
    width: 60, height: 64, borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  dateMonth: { fontSize: 9, color: colors.primary, fontWeight: typography.weight.bold, letterSpacing: 0.8 },
  dateDay: { fontSize: typography.size.xxl, color: colors.foreground, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: 0,
  },
  meta: { fontSize: typography.size.sm, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  context: { gap: spacing.sm },
  contextLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  contextLineSolo: { justifyContent: 'flex-end' },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 0 },
  detailText: {
    fontSize: typography.size.xs, fontWeight: typography.weight.medium,
    color: colors.mutedForeground, textTransform: 'capitalize',
    flexShrink: 1,
  },
  detailTextAccent: { color: colors.primary },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lookPreview: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lookCollage: {
    width: 72,
    height: 72,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  viewLookPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  viewLookText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  outfitStatus: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outfitCopy: { flex: 1, minWidth: 0, gap: 1 },
  outfitReady: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  outfitHint: { fontSize: 10, color: colors.mutedForeground },
  planIcon: {
    width: 32, height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planBtnDisabled: { opacity: 0.72 },
  planBtnText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.white },
});
