import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import type { StylistCritique, StylistCritiqueVerdict } from '../../features/stylist/types';
import type { Item } from '../../types/item';

// Verdict for a pairing check ("does X go with Y"): a clear yes / almost / no,
// the principle behind it, and the owned pieces that would fix it.

const VERDICT: Record<StylistCritiqueVerdict, { label: string; icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  works: { label: 'Works', icon: 'checkmark-circle', tint: colors.success },
  works_if: { label: 'Works with a tweak', icon: 'construct-outline', tint: colors.accentInk },
  clash: { label: 'Doesn’t work', icon: 'close-circle', tint: colors.error },
};

const PRINCIPLE: Record<StylistCritique['reasons'][number]['principle'], string> = {
  colour: 'Colour',
  proportion: 'Proportion',
  formality: 'Formality',
  texture: 'Texture',
  pattern: 'Pattern',
  season: 'Season',
};

type Props = {
  critique: StylistCritique;
  allItems: Item[];
  onItemPress?: (item: Item) => void;
};

export function CritiqueCard({ critique, allItems, onItemPress }: Props) {
  const v = VERDICT[critique.verdict];
  if (!v) return null;
  const fixes = critique.fixItemIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is Item => !!item);

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`Verdict: ${v.label}`}>
      <View style={[styles.pill, { borderColor: v.tint }]}>
        <Ionicons name={v.icon} size={14} color={v.tint} />
        <Text style={[styles.pillText, { color: v.tint }]}>{v.label}</Text>
      </View>

      {critique.reasons.map((reason, index) => (
        <View key={`${reason.principle}-${index}`} style={styles.reason}>
          <Text style={styles.principle}>{PRINCIPLE[reason.principle] ?? reason.principle}</Text>
          <Text style={styles.detail}>{reason.detail}</Text>
        </View>
      ))}

      {fixes.length > 0 ? (
        <View style={styles.fixes}>
          <Text style={styles.fixLabel}>Try instead</Text>
          <View style={styles.fixRow}>
            {fixes.map((item) => (
              <Pressable
                key={item.id}
                style={styles.fixPill}
                onPress={() => onItemPress?.(item)}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}`}
              >
                <Ionicons name="swap-horizontal-outline" size={13} color={colors.foreground} />
                <Text style={styles.fixText} numberOfLines={1}>{item.color ? `${item.color} ` : ''}{item.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#FFFFFFB8',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
  },
  reason: { gap: 2 },
  principle: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detail: {
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: typography.text.bodySmall.fontSize * 1.35,
    color: colors.foreground,
  },
  fixes: { gap: spacing.xs, marginTop: spacing.xs },
  fixLabel: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    fontWeight: typography.weight.semibold,
  },
  fixRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fixPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  fixText: {
    flexShrink: 1,
    fontSize: typography.text.caption.fontSize,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
});
