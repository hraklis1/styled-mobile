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

const CONDITION_LABELS: Record<WeatherCondition, string> = {
  sunny: 'Sunny',
  rainy: 'Rainy',
  cold: 'Cold',
  mild: 'Mild',
};

const CONDITION_META: Record<WeatherCondition, ConditionMeta> = {
  sunny: {
    icon: 'sunny-outline',
    bg: '#F5EDE5',        // warm clay
    iconColor: '#956D51', // theme primary
    textColor: '#6B4232', // deep clay
  },
  rainy: {
    icon: 'rainy-outline',
    bg: '#EBF0F2',        // cool slate
    iconColor: '#5B7A87', // blue-slate
    textColor: '#3D5560', // dark slate
  },
  cold: {
    icon: 'snow-outline',
    bg: '#EDF1F4',        // frost-mist
    iconColor: '#5C7A8A', // icy slate
    textColor: '#3D5A64', // deep frost
  },
  mild: {
    icon: 'partly-sunny-outline',
    bg: '#EAF0E8',        // sage-sand
    iconColor: '#6E8C62', // sage-green
    textColor: '#445A3C', // deep sage
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
          {CONDITION_LABELS[data.condition]} · {data.temperatureC}°C
          <Text style={styles.tempAlt}> / {data.temperatureF}°F</Text>
        </Text>
        {onPress ? (
          <Text style={[styles.cta, { color: meta.textColor }]} numberOfLines={1}>
            Tap to style a look for today's weather
          </Text>
        ) : (
          <Text style={[styles.summary, { color: meta.textColor }]} numberOfLines={1}>
            {data.summary}
          </Text>
        )}
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
    letterSpacing: 0,
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
  cta: {
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * 1.4,
    fontStyle: 'italic',
    opacity: 0.8,
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
