import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventWeatherForecast, type WeatherCondition } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import { ItemThumbStack } from './ItemThumbStack';
import {
  OCCASIONS,
  formatDayLabel,
  formatCountdown,
  formatTime,
} from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import { presentCalendarEvent } from './calendar-presentation';

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
  isPremium,
  onPress,
  onPlanOutfit,
  onPressOutfit,
  isPlanning,
}: {
  event: Event;
  allItems: Item[];
  weatherFallback: StylingLocationContext | null;
  isPremium: boolean;
  onPress: () => void;
  onPlanOutfit: () => void;
  onPressOutfit: () => void;
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
  const actionLabel = hasOutfit ? 'View outfit' : 'Plan outfit';

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.9}
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

      <View style={s.metaDetails}>
        {occasionMeta ? (
          <View style={s.detail}>
            <Ionicons name="shirt-outline" size={12} color={colors.primary} />
            <Text style={[s.detailText, s.detailTextAccent]}>{occasionMeta.label}</Text>
          </View>
        ) : null}
        {event.location ? (
          <View style={[s.detail, s.detailShrink]}>
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={s.detailText} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
        {forecast.data ? (
          <View style={s.detail}>
            <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={12} color={colors.mutedForeground} />
            <Text style={s.detailText}>{formatTempRange(forecast.data, tempUnit)}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.actionRow}>
        {hasOutfit ? (
          <View style={s.outfitStatus}>
            <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={onPressOutfit} />
            <View style={s.outfitCopy}>
              <Text style={s.outfitReady}>Outfit ready</Text>
              <Text style={s.outfitHint}>Tap to review your pieces</Text>
            </View>
          </View>
        ) : (
          <View style={s.outfitStatus}>
            <View style={s.planIcon}>
              <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
            </View>
            <View style={s.outfitCopy}>
              <Text style={s.outfitReady}>Needs an outfit</Text>
              <Text style={s.outfitHint}>Plan from your wardrobe</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[s.planBtn, hasOutfit && s.planBtnSecondary, isPlanning && s.planBtnDisabled]}
          onPress={hasOutfit ? onPressOutfit : onPlanOutfit}
          disabled={isPlanning}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isPlanning
            ? `Styling an outfit for ${event.title}`
            : `${actionLabel} for ${event.title}${isPremium || hasOutfit ? '' : ', Premium feature'}`}
          accessibilityState={{ disabled: isPlanning, busy: isPlanning }}
        >
          {isPlanning ? (
            <ActivityIndicator size="small" color={hasOutfit ? colors.primary : colors.white} />
          ) : (
            <Ionicons
              name={hasOutfit ? 'arrow-forward' : 'sparkles-outline'}
              size={14}
              color={hasOutfit ? colors.primary : colors.white}
            />
          )}
          <Text style={[s.planBtnText, hasOutfit && s.planBtnTextSecondary]}>
            {isPlanning ? 'Styling…' : actionLabel}
          </Text>
          {!isPremium && !hasOutfit ? (
            <View style={s.proPill}>
              <Text style={s.proPillText}>PRO</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderCurve: 'continuous',
  },
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
    width: 52, height: 56, borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  dateMonth: { fontSize: 9, color: colors.primary, fontWeight: typography.weight.bold, letterSpacing: 0.8 },
  dateDay: { fontSize: typography.size.xl, color: colors.foreground, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: 0,
  },
  meta: { fontSize: typography.size.sm, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  metaDetails: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  detailShrink: { flexShrink: 1 },
  detailText: {
    fontSize: 11, fontWeight: typography.weight.medium,
    color: colors.mutedForeground, textTransform: 'capitalize',
    flexShrink: 1,
  },
  detailTextAccent: { color: colors.primary },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
    width: 32, height: 32, borderRadius: 16,
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
  planBtnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  planBtnDisabled: { opacity: 0.72 },
  planBtnText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.white },
  planBtnTextSecondary: { color: colors.primary },
  proPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 1,
  },
  proPillText: { fontSize: 9, fontWeight: typography.weight.bold, color: colors.white, letterSpacing: 0.5 },
});
