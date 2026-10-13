import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import type { StylistCritique, StylistCritiqueVerdict } from '../../features/stylist/types';
import type { Item } from '../../types/item';

// Verdict for a pairing check ("does X go with Y"): a clear yes / almost / no,
// the principle behind it, and the owned pieces that would fix it.

// The headline is the stylist's call in a word or two; the colour is only a quiet dot beside it.
const VERDICT: Record<StylistCritiqueVerdict, { label: string; headline: string; tint: string }> = {
  works: { label: 'Works', headline: 'Wear it.', tint: colors.success },
  works_if: { label: 'Works with a tweak', headline: 'Almost — one change.', tint: colors.accentInk },
  clash: { label: 'Doesn’t work', headline: 'Choose something else.', tint: colors.error },
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
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: v.tint }]} />
        <Text style={styles.label}>{v.label}</Text>
      </View>
      <Text style={styles.headline}>{v.headline}</Text>

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
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderCurve: 'continuous',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...typography.text.eyebrow, color: colors.mutedForeground },
  headline: { ...typography.text.editorialTitle, color: colors.foreground },
  reason: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  principle: { ...typography.text.eyebrow, color: colors.mutedForeground },
  detail: { ...typography.text.body, color: colors.foreground },
  fixes: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  fixLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  fixRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fixPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  fixText: { ...typography.text.bodySmall, flexShrink: 1, color: colors.foreground },
});
