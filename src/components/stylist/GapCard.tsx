import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

// ── Wardrobe gap card ──────────────────────────────────────────────────────────
// Shared by the advice ("what's missing") reply and the outfit-suggestion card.
// Renders a single structural wardrobe gap with a category icon, the gap label,
// its full reasoning (`context`), a type tag derived from `reason`, optional
// "unlocks" occasion pills, and a Shop CTA when a shop navigation handler exists.

export type GapItem = {
  label: string;
  category: string;
  reason: string;
  context: string;
  priority: number;
  unlocks?: string[];
};

// reason is an enum from the backend schema — map it to a short human tag.
const REASON_LABEL: Record<string, string> = {
  weather: 'Weather',
  occasion: 'Occasion',
  wardrobe_gap: 'Wardrobe gap',
  ratio_imbalance: 'Balance',
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function categoryIcon(category: string): IoniconName {
  switch (category?.toLowerCase()) {
    case 'top':
    case 'tops':
      return 'shirt-outline';
    case 'outerwear':
      return 'layers-outline';
    case 'shoe':
    case 'shoes':
      return 'footsteps-outline';
    case 'bottom':
    case 'bottoms':
      return 'walk-outline';
    case 'full_body':
      return 'body-outline';
    case 'accessory':
    case 'accessories':
      return 'glasses-outline';
    default:
      return 'bag-handle-outline';
  }
}

type GapCardProps = {
  item: GapItem;
  onPress?: () => void;
  ctaLabel?: string;
  style?: object;
};

export function GapCard({ item, onPress, ctaLabel = 'Shop', style }: GapCardProps) {
  const emphasized = item.priority === 1;
  const reasonTag = REASON_LABEL[item.reason];
  const Container: typeof TouchableOpacity | typeof View = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, emphasized && styles.cardEmphasized, style]}
      {...(onPress ? { onPress, activeOpacity: 0.78, accessibilityRole: 'button' as const } : {})}
    >
      <View style={[styles.iconWrap, emphasized && styles.iconWrapEmphasized]}>
        <Ionicons name={categoryIcon(item.category)} size={18} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          {!!reasonTag && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{reasonTag}</Text>
            </View>
          )}
        </View>
        {!!item.context && (
          <Text style={styles.context} numberOfLines={2}>{item.context}</Text>
        )}
        {!!item.unlocks?.length && (
          <View style={styles.unlocksRow}>
            <Text style={styles.unlocksLabel}>Unlocks</Text>
            <Text style={styles.unlocksText} numberOfLines={1}>{item.unlocks.slice(0, 3).join(' · ')}</Text>
          </View>
        )}
      </View>

      {onPress && (
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#FFFFFFB8',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  cardEmphasized: {
    backgroundColor: '#FFFFFFE0',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapEmphasized: {
    backgroundColor: `${colors.primary}26`,
  },
  body: { flex: 1, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    flexShrink: 1,
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
  },
  tag: {
    flexShrink: 0,
  },
  tagText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.3,
  },
  context: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: typography.size.xs * 1.45,
  },
  unlocksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  unlocksLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  unlocksText: {
    flex: 1,
    fontSize: 10,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  cta: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  ctaText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
});
