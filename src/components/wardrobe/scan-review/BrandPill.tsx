import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../../../theme';

/**
 * The brand, attributed right on the card. Empty, it is a dashed "+ Brand"
 * invitation; set, a quiet hairline label that reopens the brand search.
 */
export function BrandPill({ brand, name, disabled, onPress }: { brand: string; name: string; disabled?: boolean; onPress: () => void }) {
  const set = Boolean(brand.trim());
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={{ top: 8, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [styles.pill, set ? styles.pillSet : styles.pillEmpty, pressed && styles.pressed]}
      accessibilityRole="button" accessibilityLabel={set ? `Brand ${brand}, change` : `Add brand to ${name || 'piece'}`}>
      {set ? null : <Ionicons name="add" size={12} color={colors.mutedForeground} />}
      <Text style={[styles.label, !set && styles.labelEmpty]} numberOfLines={1}>{set ? brand : 'Brand'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 2,
    minHeight: 22, paddingHorizontal: spacing.sm, borderRadius: radii.full, borderWidth: StyleSheet.hairlineWidth, marginBottom: 2,
  },
  pillEmpty: { borderStyle: 'dashed', borderColor: colors.mutedForeground },
  pillSet: { borderColor: colors.border },
  pressed: { backgroundColor: colors.surfaceSelected },
  label: { ...typography.text.eyebrow, color: colors.foreground, flexShrink: 1 },
  labelEmpty: { color: colors.mutedForeground },
});
