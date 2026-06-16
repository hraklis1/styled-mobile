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
import { colors, spacing, typography, radii } from '../../theme';
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
  isPremium,
  onPress,
  onPlanOutfit,
  onPressOutfit,
}: {
  event: Event;
  allItems: Item[];
  deviceCoords: { lat: number; lon: number } | null;
  isPremium: boolean;
  onPress: () => void;
  onPlanOutfit: () => void;
  onPressOutfit: () => void;
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

      <View style={s.metaDetails}>
        {occasionMeta ? (
          <Text style={s.detailText}>{occasionMeta.label}</Text>
        ) : null}
        {forecast.data ? (
          <View style={s.detail}>
            {occasionMeta ? <Text style={s.detailDot}>·</Text> : null}
            <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={12} color={colors.mutedForeground} />
            <Text style={s.detailText}>{forecast.data.tempMinF}–{forecast.data.tempMaxF}°F</Text>
          </View>
        ) : null}
        {event.location ? (
          <View style={[s.detail, s.detailShrink]}>
            {occasionMeta || forecast.data ? <Text style={s.detailDot}>·</Text> : null}
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={s.detailText} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.actionRow}>
        {hasOutfit ? (
          <View style={s.outfitStatus}>
            <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={onPressOutfit} />
            <Text style={s.outfitReady}>Outfit planned</Text>
          </View>
        ) : (
          <Text style={s.outfitPrompt}>No outfit planned yet</Text>
        )}
        <TouchableOpacity
          style={[s.planBtn, hasOutfit && s.planBtnSecondary]}
          onPress={onPlanOutfit}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${getEventPlanActionLabel(hasOutfit)} for ${event.title}${isPremium ? '' : ', Premium feature'}`}
        >
          <Ionicons
            name="sparkles-outline"
            size={14}
            color={hasOutfit ? colors.primary : colors.white}
          />
          <Text style={[s.planBtnText, hasOutfit && s.planBtnTextSecondary]}>
            {getEventPlanActionLabel(hasOutfit)}
          </Text>
          {!isPremium ? (
            <View style={[s.proPill, hasOutfit && s.proPillSecondary]}>
              <Text style={[s.proPillText, hasOutfit && s.proPillTextSecondary]}>PRO</Text>
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
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
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
  iconBox: {
    width: 44, height: 44, borderRadius: radii.md,
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

  metaDetails: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detailShrink: { flexShrink: 1 },
  detailDot: { fontSize: typography.size.xs, color: colors.mutedForeground },
  detailText: {
    fontSize: 11, fontWeight: typography.weight.medium,
    color: colors.mutedForeground, textTransform: 'capitalize',
    flexShrink: 1,
  },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, paddingTop: spacing.xs,
  },
  outfitStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outfitReady: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  outfitPrompt: { flex: 1, fontSize: typography.size.xs, color: colors.mutedForeground },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planBtnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  planBtnText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.white },
  planBtnTextSecondary: { color: colors.primary },
  proPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 1,
  },
  proPillSecondary: { backgroundColor: `${colors.primary}15` },
  proPillText: { fontSize: 9, fontWeight: typography.weight.bold, color: colors.white, letterSpacing: 0.5 },
  proPillTextSecondary: { color: colors.primary },
});
