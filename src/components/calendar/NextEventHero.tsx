import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeatherForecast, type WeatherCondition } from '../../hooks/useWeather';
import { ItemThumbStack } from './ItemThumbStack';
import {
  OCCASIONS,
  OCCASION_ICONS,
  formatDayLabel,
  formatCountdown,
  formatTime,
} from './calendarUtils';
import { colors, spacing, typography, radii, shadows } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import { getEventPlanActionLabel } from './calendarPlanning';

const WEATHER_ICONS: Record<WeatherCondition, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold: 'snow-outline',
  mild: 'partly-sunny-outline',
};

export function NextEventHero({
  event,
  allItems,
  deviceCoords,
  onPress,
  onPlanOutfit,
  onPressOutfit,
  onChooseOutfit,
}: {
  event: Event;
  allItems: Item[];
  deviceCoords: { lat: number; lon: number } | null;
  onPress: () => void;
  onPlanOutfit: () => void;
  onPressOutfit: () => void;
  onChooseOutfit: () => void;
}) {
  const forecast = useWeatherForecast(
    deviceCoords?.lat ?? null,
    deviceCoords?.lon ?? null,
    event.date.slice(0, 10),
  );

  const d = new Date(event.date);
  const dayLabel = formatDayLabel(d);
  const badge = formatCountdown(d) ?? (dayLabel === 'Today' || dayLabel === 'Tomorrow' ? dayLabel : null);
  const occasionMeta = OCCASIONS.find((o) => o.id === event.occasion);
  const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
  const hasOutfit = (event.itemIds ?? []).length > 0;

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
        <View style={s.iconBox}>
          <Ionicons name={iconName} size={22} color={colors.primary} />
        </View>
        <View style={s.body}>
          <Text style={s.title} numberOfLines={2}>{event.title}</Text>
          <Text style={s.meta}>
            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(d)}
          </Text>
        </View>
      </View>

      <View style={s.chipRow}>
        {occasionMeta ? (
          <View style={s.chip}>
            <Text style={s.chipText}>{occasionMeta.label}</Text>
          </View>
        ) : null}
        {forecast.data ? (
          <View style={s.chip}>
            <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={12} color={colors.mutedForeground} />
            <Text style={s.chipText}>{forecast.data.tempMinF}–{forecast.data.tempMaxF}°F</Text>
          </View>
        ) : null}
        {event.location ? (
          <View style={[s.chip, s.chipShrink]}>
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={s.chipText} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.divider} />

      {hasOutfit ? (
        <View style={s.outfitRow}>
          <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={onPressOutfit} />
          <Text style={s.outfitReady}>Outfit planned</Text>
          <TouchableOpacity
            style={s.changeBtn}
            onPress={onChooseOutfit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Choose saved outfit for ${event.title}`}
          >
            <Ionicons name="albums-outline" size={12} color={colors.mutedForeground} />
            <Text style={s.changeBtnText}>Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.changeBtn}
            onPress={onPlanOutfit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Try another outfit for ${event.title}`}
          >
            <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
            <Text style={s.changeBtnText}>Try another</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.ctaRow}>
          <TouchableOpacity
            style={s.planBtn}
            onPress={onPlanOutfit}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Plan outfit for ${event.title}`}
          >
            <Ionicons name="sparkles-outline" size={15} color={colors.white} />
            <Text style={s.planBtnText}>{getEventPlanActionLabel(hasOutfit)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.pickBtn}
            onPress={onChooseOutfit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Choose saved outfit for ${event.title}`}
          >
            <Ionicons name="albums-outline" size={15} color={colors.foreground} />
            <Text style={s.pickBtnText}>Choose outfit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.pickBtn}
            onPress={onPressOutfit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Choose items for ${event.title}`}
          >
            <Ionicons name="shirt-outline" size={15} color={colors.foreground} />
            <Text style={s.pickBtnText}>Choose items</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
    ...shadows.warm,
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
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 48, height: 48, borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  meta: { fontSize: typography.size.sm, color: colors.mutedForeground, fontWeight: typography.weight.medium },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.background,
    borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 4,
  },
  chipShrink: { flexShrink: 1 },
  chipText: {
    fontSize: 11, fontWeight: typography.weight.medium,
    color: colors.mutedForeground, textTransform: 'capitalize',
    flexShrink: 1,
  },

  divider: { height: 1, backgroundColor: colors.border },

  outfitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outfitReady: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  changeBtnText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },

  ctaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  planBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
  },
  planBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },
  pickBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
  },
  pickBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
});
