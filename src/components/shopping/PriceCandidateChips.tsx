import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import type { ShoppingPriceCandidate } from '../../lib/shoppingPrices';
import { cameraColors, colors, radii, spacing, typography } from '../../theme';

export type PriceChoice = { amount: number; currencyCode: string | null };

function chipLabel(candidate: ShoppingPriceCandidate): string {
  return formatShoppingPrice(candidate.amount, candidate.currencyCode)
    ?? `${candidate.amount.toLocaleString()} · ?`;
}

/**
 * The prices OCR read off a tag, as one row of one-tap choices. Used in the
 * camera dock (dark) and on shortlist surfaces (light) so confirming a price
 * is the same single tap everywhere and never opens a form.
 */
export function PriceCandidateChips({
  candidates,
  selected,
  prompt,
  tone = 'light',
  disabled,
  onPick,
}: {
  candidates: ShoppingPriceCandidate[];
  /** The amount currently in force, drawn as chosen. */
  selected?: PriceChoice | null;
  /** Short lead-in, e.g. "Which price?" */
  prompt?: string;
  tone?: 'light' | 'camera';
  disabled?: boolean;
  onPick: (choice: PriceChoice) => void;
}) {
  if (candidates.length === 0) return null;
  const dark = tone === 'camera';
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={prompt ?? 'Choose a price'}>
      {prompt ? <Text style={[styles.prompt, dark && styles.promptDark]}>{prompt}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {candidates.map((candidate) => {
          const active = selected?.amount === candidate.amount
            && (selected.currencyCode ?? null) === (candidate.currencyCode ?? null);
          return (
            <TouchableOpacity
              key={`${candidate.amount}-${candidate.currencyCode ?? ''}`}
              disabled={disabled || active}
              onPress={() => {
                void Haptics.selectionAsync();
                onPick({ amount: candidate.amount, currencyCode: candidate.currencyCode ?? null });
              }}
              style={[styles.chip, dark && styles.chipDark, active && (dark ? styles.chipActiveDark : styles.chipActive)]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
              accessibilityLabel={`${chipLabel(candidate)}${candidate.currencyCode ? '' : ', currency unknown'}`}
            >
              <Text style={[styles.label, dark && styles.labelDark, active && (dark ? styles.labelActiveDark : styles.labelActive)]}>
                {chipLabel(candidate)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prompt: { ...typography.text.caption, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  promptDark: { color: cameraColors.onCameraMuted },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipDark: { borderColor: 'rgba(255, 252, 247, 0.28)', backgroundColor: cameraColors.control },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipActiveDark: { borderColor: cameraColors.onCamera, backgroundColor: cameraColors.onCamera },
  label: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  labelDark: { color: cameraColors.onCamera },
  labelActive: { color: colors.primaryForeground },
  labelActiveDark: { color: cameraColors.backdrop },
});
