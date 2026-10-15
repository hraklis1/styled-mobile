import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '../../../theme';

/**
 * The brand, attributed right on the card, in the same voice as a piece row:
 * set, the brand itself in small caps; empty, a faint "Add brand" offer.
 * Either way it reopens the brand search, and never opens the piece.
 */
export function BrandPill({ brand, name, disabled, onPress }: { brand: string; name: string; disabled?: boolean; onPress: () => void }) {
  const set = Boolean(brand.trim());
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={{ top: 10, bottom: 8, left: 8, right: 16 }}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      accessibilityRole="button" accessibilityLabel={set ? `Brand ${brand}, change` : `Add brand to ${name || 'piece'}`}>
      <Text style={set ? styles.brand : styles.add} numberOfLines={1}>{set ? brand : 'Add brand'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 18, justifyContent: 'center', marginBottom: spacing.xs / 2 },
  pressed: { opacity: 0.6 },
  brand: { ...typography.text.eyebrow, color: colors.foreground },
  add: { ...typography.text.caption, color: colors.inkSubtle, textDecorationLine: 'underline', textDecorationColor: colors.hairline },
});
