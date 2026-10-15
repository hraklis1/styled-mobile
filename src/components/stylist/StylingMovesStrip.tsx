import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

// Up to three look-level moves ("Match belt to shoes") under a stylist reply.
export function StylingMovesStrip({ moves }: { moves?: string[] }) {
  if (!moves?.length) return null;
  return (
    <View style={styles.wrap} accessibilityLabel={`Styling moves: ${moves.join('. ')}`}>
      <Text style={styles.label}>Styling moves</Text>
      {moves.map((move, index) => (
        <View key={`${index}-${move}`} style={styles.row}>
          <Text style={styles.index}>{index + 1}</Text>
          <Text style={styles.move}>{move}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  index: {
    ...typography.text.caption,
    width: 14,
    color: colors.accentInk,
    fontWeight: typography.weight.semibold,
  },
  move: {
    ...typography.text.bodySmall,
    flex: 1,
    lineHeight: typography.text.bodySmall.fontSize * 1.35,
    color: colors.foreground,
  },
});
