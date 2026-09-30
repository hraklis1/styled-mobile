import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { TextLink } from './atoms';
import { pieceCountLabel } from './types';

export type ActionBarMode =
  | { kind: 'extract'; count: number; extractionCount: number; additional?: boolean; onExtract: () => void; onBatch?: () => void }
  | { kind: 'save'; count: number; flagged: number; onSave: () => void; onReviewFlagged: () => void; onBatch?: () => void }
  | { kind: 'confirm'; last: boolean; onConfirm: () => void; onSkip: (() => void) | null }
  | { kind: 'selecting'; count: number; review: boolean; onBrand: () => void; onSeason: () => void; onConfirm: () => void; onDone: () => void; onSelectAll: () => void; onClear: () => void }
  | { kind: 'failed'; count: number; onRetry: () => void; onKeepBasic: () => void }
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
        <WithBatch onBatch={mode.onBatch}>
          <PrimaryButton disabled={mode.count === 0} label={mode.count === 0 ? 'Choose at least 1 piece' : mode.additional ? `Extract details for ${mode.extractionCount} new ${mode.extractionCount === 1 ? 'piece' : 'pieces'}` : `Extract ${pieceCountLabel(mode.extractionCount)}`} icon={mode.count === 0 ? undefined : 'sparkles'} onPress={mode.onExtract} />
        </WithBatch>
      ) : mode.kind === 'save' ? (
        <>
          <WithBatch onBatch={mode.onBatch}>
            <PrimaryButton disabled={mode.count === 0} label={mode.count === 0 ? 'Choose at least 1 piece' : mode.count === 1 ? 'Add to closet' : `Add ${pieceCountLabel(mode.count)} to closet`} onPress={mode.onSave} />
          </WithBatch>
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
          {mode.onSkip ? (
            <TouchableOpacity style={styles.skip} onPress={mode.onSkip} accessibilityRole="button" accessibilityLabel="Skip to the next piece without confirming">
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.flex}>
            <PrimaryButton label={mode.last ? 'Confirm · Done' : 'Confirm & next'} onPress={mode.onConfirm} />
          </View>
        </View>
      ) : mode.kind === 'failed' ? (
        <><PrimaryButton label={`Retry ${pieceCountLabel(mode.count)}`} onPress={mode.onRetry} /><TextLink label="Keep basic details" onPress={mode.onKeepBasic} /></>
      ) : mode.kind === 'selecting' ? (
        <><View style={styles.bulkRow}><Text style={styles.bulkText}>{mode.count} selected</Text><TextLink label="Select all shown" onPress={mode.onSelectAll} /><TextLink label="Clear selection" onPress={mode.onClear} /></View><View style={styles.bulkRow}>
          <BulkAction icon="pricetag-outline" label="Brand" disabled={mode.count === 0} onPress={mode.onBrand} />
          <BulkAction icon="leaf-outline" label="Season" disabled={mode.count === 0 || !mode.review} onPress={mode.onSeason} hidden={!mode.review} />
          <BulkAction icon="checkmark" label="Mark reviewed" disabled={mode.count === 0} onPress={mode.onConfirm} hidden={!mode.review} />
          <BulkAction icon="checkmark-done" label="Done" disabled={false} onPress={mode.onDone} />
        </View></>
      ) : (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>{mode.label}</Text>
        </View>
      )}
    </View>
  );
}

/** The primary action with the batch-edit menu beside it, in one thumb row. */
function WithBatch({ onBatch, children }: { onBatch?: () => void; children: ReactNode }) {
  if (!onBatch) return <>{children}</>;
  return (
    <View style={styles.confirmRow}>
      <View style={styles.flex}>{children}</View>
      <TouchableOpacity style={styles.batch} onPress={onBatch} accessibilityRole="button" accessibilityLabel="Edit pieces" activeOpacity={0.7}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

/** Disabled reads as guidance, an outline, rather than a greyed-out button. */
export function PrimaryButton({ label, icon, onPress, disabled = false }: { disabled?: boolean; label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity disabled={disabled} accessibilityState={{ disabled }} style={[styles.primary, disabled && styles.primaryIdle]} onPress={onPress} accessibilityRole="button" activeOpacity={0.85}>
      {icon ? <Ionicons name={icon} size={17} color={disabled ? colors.mutedForeground : colors.primaryForeground} /> : null}
      <Text style={[styles.primaryText, disabled && styles.primaryIdleText]}>{label}</Text>
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
  primaryIdle: { backgroundColor: 'transparent', borderWidth: stroke.fine, borderColor: colors.controlOutline },
  primaryIdleText: { color: colors.mutedForeground },
  batch: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.fine, borderColor: colors.controlOutline },
  primaryText: { textAlign: 'center', ...typography.text.sectionTitle, color: colors.primaryForeground },
  secondary: { alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  skip: { minHeight: 56, minWidth: 64, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...typography.text.label, color: colors.mutedForeground },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-around', minHeight: 56 },
  bulk: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56 },
  bulkDisabled: { opacity: 0.35 },
  bulkText: { ...typography.text.caption, fontWeight: typography.weight.medium, color: colors.foreground },
  busy: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  busyText: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
