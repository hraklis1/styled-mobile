import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeatherCurrent, type WeatherCondition } from '../../hooks/useWeather';
import { colors, spacing, typography, radii } from '../../theme';

// ── Condition config ─────────────────────────────────────────────────────────

type ConditionMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  iconColor: string;
  textColor: string;
};

const CONDITION_META: Record<WeatherCondition, ConditionMeta> = {
  sunny: {
    icon: 'sunny-outline',
    bg: '#fffbeb',
    iconColor: '#d97706',
    textColor: '#92620a',
  },
  rainy: {
    icon: 'rainy-outline',
    bg: '#eff6ff',
    iconColor: '#2563eb',
    textColor: '#1e40af',
  },
  cold: {
    icon: 'snow-outline',
    bg: '#f0f9ff',
    iconColor: '#0284c7',
    textColor: '#0369a1',
  },
  mild: {
    icon: 'partly-sunny-outline',
    bg: '#f0fdf4',
    iconColor: '#16a34a',
    textColor: '#15803d',
  },
};

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  onPress?: () => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function WeatherWidget({ onPress }: Props) {
  const { data, isLoading, isError, refetch } = useWeatherCurrent();

  if (isLoading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <View style={styles.loadingIconPlaceholder} />
        <View style={styles.loadingLines}>
          <View style={[styles.loadingLine, { width: '55%' }]} />
          <View style={[styles.loadingLine, { width: '80%', marginTop: 5 }]} />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return null;
  }

  const meta = CONDITION_META[data.condition];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: meta.bg }]}
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${meta.iconColor}20` }]}>
        <Ionicons name={meta.icon} size={22} color={meta.iconColor} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.temp, { color: meta.textColor }]}>
          {data.temperatureC}°C
          <Text style={styles.tempAlt}> · {data.temperatureF}°F</Text>
        </Text>
        <Text style={[styles.summary, { color: meta.textColor }]} numberOfLines={1}>
          {data.summary}
        </Text>
        {data.locationLabel ? (
          <Text style={[styles.location, { color: meta.textColor }]} numberOfLines={1}>
            {data.locationLabel}
          </Text>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={meta.iconColor} style={styles.chevron} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.border}80`,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  loadingCard: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  temp: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.2,
  },
  tempAlt: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.regular,
    opacity: 0.7,
  },
  summary: {
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * 1.4,
  },
  location: {
    fontSize: 10,
    opacity: 0.65,
    marginTop: 1,
  },
  chevron: {
    flexShrink: 0,
    opacity: 0.6,
  },

  // Loading skeleton
  loadingIconPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  loadingLines: {
    flex: 1,
    gap: 0,
  },
  loadingLine: {
    height: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
});
