import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { TextLink } from './atoms';
import { pieceCountLabel } from './types';

export type ActionBarMode =
  | { kind: 'extract'; count: number; onExtract: () => void }
  | { kind: 'save'; count: number; flagged: number; onSave: () => void; onReviewFlagged: () => void }
  | { kind: 'confirm'; last: boolean; onConfirm: () => void; onSkip: (() => void) | null }
  | { kind: 'selecting'; count: number; review: boolean; onBrand: () => void; onSeason: () => void; onConfirm: () => void; onRemove: () => void }
  | { kind: 'busy'; label: string };

/**
 * The one decision the screen is asking for, and at most one quiet way
 * round it. Saving is never blocked on review: a flagged piece can be fixed
 * in the closet later, so the triage link sits under the button, not in
 * front of it.
 */
export function ActionBar({ mode, bottomInset }: { mode: ActionBarMode; bottomInset: number }) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      {mode.kind === 'extract' ? (
        // The sparkle is reserved for the action that spends credits.
        <PrimaryButton label={`Extract details for ${mode.count === 1 ? 'this piece' : `all ${mode.count}`}`} icon="sparkles" onPress={mode.onExtract} />
      ) : mode.kind === 'save' ? (
        <>
          <PrimaryButton label={mode.count === 1 ? 'Add to closet' : `Add ${pieceCountLabel(mode.count)} to closet`} onPress={mode.onSave} />
          {mode.flagged > 0 ? (
            <View style={styles.secondary}>
              <TextLink
                label={mode.flagged === 1 ? 'Review the 1 flagged piece' : `Review the ${mode.flagged} flagged`}
                onPress={mode.onReviewFlagged}
              />
            </View>
          ) : null}
        </>
      ) : mode.kind === 'confirm' ? (
        <View style={styles.confirmRow}>
          <View style={styles.flex}>
            <PrimaryButton label={mode.last ? 'Looks right · Done' : 'Looks right'} onPress={mode.onConfirm} />
          </View>
          {mode.onSkip ? (
            <TouchableOpacity style={styles.skip} onPress={mode.onSkip} accessibilityRole="button" accessibilityLabel="Next piece, without confirming">
              <Text style={styles.skipText}>Next</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.foreground} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : mode.kind === 'selecting' ? (
        <View style={styles.bulkRow}>
          <BulkAction icon="pricetag-outline" label="Brand" disabled={mode.count === 0} onPress={mode.onBrand} />
          <BulkAction icon="leaf-outline" label="Season" disabled={mode.count === 0 || !mode.review} onPress={mode.onSeason} hidden={!mode.review} />
          <BulkAction icon="checkmark" label="Confirm" disabled={mode.count === 0} onPress={mode.onConfirm} hidden={!mode.review} />
          <BulkAction icon="trash-outline" label="Remove" disabled={mode.count === 0} onPress={mode.onRemove} />
        </View>
      ) : (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>{mode.label}</Text>
        </View>
      )}
    </View>
  );
}

function PrimaryButton({ label, icon, onPress }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.primary} onPress={onPress} accessibilityRole="button" activeOpacity={0.85}>
      {icon ? <Ionicons name={icon} size={17} color={colors.primaryForeground} /> : null}
      <Text style={styles.primaryText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function BulkAction({ icon, label, disabled, hidden, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  hidden?: boolean;
  onPress: () => void;
}) {
  if (hidden) return null;
  return (
    <TouchableOpacity
      style={[styles.bulk, disabled && styles.bulkDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={19} color={colors.foreground} />
      <Text style={styles.bulkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
  primary: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  primaryText: { ...typography.text.sectionTitle, color: colors.primaryForeground },
  secondary: { alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  skip: { minHeight: 56, minWidth: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  skipText: { ...typography.text.label, color: colors.foreground },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-around', minHeight: 56 },
  bulk: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56 },
  bulkDisabled: { opacity: 0.35 },
  bulkText: { ...typography.text.caption, fontWeight: typography.weight.medium, color: colors.foreground },
  busy: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  busyText: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
