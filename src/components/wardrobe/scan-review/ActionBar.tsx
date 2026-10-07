import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { TextLink } from './atoms';
import { pieceCountLabel } from './types';
import { GuidedFooter, guidedLabel } from './GuidedFooter';

export type ActionBarMode =
  | { kind: 'extract'; count: number; extractionCount: number; additional?: boolean; onExtract: () => void; onBatch?: () => void }
  | { kind: 'save'; count: number; flagged: number; onSave: () => void; onReviewFlagged: () => void; onBatch?: () => void; polish?: PolishRowState }
  | { kind: 'confirm'; last: boolean; onConfirm: () => void; onSkip: (() => void) | null }
  | { kind: 'failed'; count: number; onRetry: () => void; onKeepBasic: () => void }
  | { kind: 'busy'; label: string };

export type PolishRowState = {
  /** Included pieces that will be polished. */
  count: number;
  /** Included pieces in all. */
  total: number;
  /** Credits the polishes will cost; 0 when the price isn't known yet. */
  cost: number;
  /** Credit balance, or null while it's unknown. */
  balance: number | null;
  /** Not premium: the row is an invitation, and the switch opens the paywall. */
  locked: boolean;
  onToggle: (next: boolean) => void;
  /** Shows a before/after of a polished piece; omitted when there's none to show. */
  onExample?: () => void;
};

/** "Add 2 pieces to closet · Polish", or "· Polish 1" when only some will be. */
export function saveLabel(count: number, polish?: PolishRowState): string {
  if (count === 0) return 'Choose at least 1 piece';
  const polishing = polish?.count ?? 0;
  if (polishing > 0 && polishing < count) return `Add ${pieceCountLabel(count)} · Polish ${polishing}`;
  const base = count === 1 ? 'Add to closet' : `Add ${pieceCountLabel(count)} to closet`;
  return polishing > 0 ? `${base} · Polish` : base;
}

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
          {mode.additional
            ? <PrimaryButton disabled={mode.count === 0} label={mode.count === 0 ? 'Select at least one piece' : `Extract details for ${mode.extractionCount} new ${mode.extractionCount === 1 ? 'piece' : 'pieces'}`} icon={mode.count === 0 ? undefined : 'sparkles'} onPress={mode.onExtract} />
            : <PrimaryButton disabled={mode.count === 0} label={mode.count === 0 ? 'Select at least one piece' : `Continue with ${pieceCountLabel(mode.extractionCount)}`} trailingIcon={mode.count === 0 ? undefined : 'arrow-forward'} onPress={mode.onExtract} />}
        </WithBatch>
      ) : mode.kind === 'save' ? (
        <>
          {mode.polish && mode.count > 0 ? <PolishRow state={mode.polish} /> : null}
          <WithBatch onBatch={mode.onBatch}>
            {mode.flagged > 0 && mode.count > 0
              ? <PrimaryButton label={mode.flagged === 1 ? 'Review 1 flagged piece' : `Review ${mode.flagged} flagged pieces`} onPress={mode.onReviewFlagged} />
              : <PrimaryButton disabled={mode.count === 0} label={saveLabel(mode.count, mode.polish)} onPress={mode.onSave} />}
          </WithBatch>
          {mode.flagged > 0 && mode.count > 0 ? (
            <View style={styles.secondary}>
              <TextLink label={mode.count === 1 ? 'Add to closet now' : `Add all ${mode.count} to closet now`} onPress={mode.onSave} />
            </View>
          ) : null}
        </>
      ) : mode.kind === 'confirm' ? (
        <GuidedFooter label={guidedLabel({ last: mode.last, lastLabel: 'Done' })} onConfirm={mode.onConfirm} onSkip={mode.onSkip} />
      ) : mode.kind === 'failed' ? (
        <><PrimaryButton label={`Retry ${pieceCountLabel(mode.count)}`} onPress={mode.onRetry} /><TextLink label="Keep basic details" onPress={mode.onKeepBasic} /></>
      ) : (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>{mode.label}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Opt-in for polished covers, decided with the save. The polishes run after
 * the pieces land, so the button never waits on a generation.
 */
function PolishRow({ state }: { state: PolishRowState }) {
  const on = state.count > 0;
  const mixed = on && state.count < state.total;
  // Partial means "turn the rest on"; only a full set turns off.
  const next = mixed || !on;
  const short = on && state.balance != null && state.cost > state.balance;
  const price = state.cost > 0 ? `${state.cost} credit${state.cost === 1 ? '' : 's'}` : null;
  const detail = state.locked
    ? 'Studio-quality covers · Premium'
    : short
      ? `Needs ${state.cost} credits · you have ${state.balance}`
      : on && price && state.balance != null
        ? `${price} · ${state.balance} available`
        : ['Studio-quality covers', price].filter(Boolean).join(' · ');
  return (
    <View style={styles.polish}>
      <TouchableOpacity
        style={styles.polishMain}
        activeOpacity={0.7}
        onPress={() => state.onToggle(next)}
        accessibilityRole="switch"
        accessibilityState={{ checked: mixed ? 'mixed' : on }}
        accessibilityLabel={`Polish photos. ${detail}`}
      >
        <Ionicons name={state.locked ? 'lock-closed-outline' : 'sparkles-outline'} size={18} color={colors.foreground} />
        <View style={styles.flex}>
          <View style={styles.polishTitleLine}>
            <Text style={styles.polishTitle}>{mixed ? `Polish ${state.count} of ${state.total}` : 'Polish photos'}</Text>
            {state.onExample ? (
              <Pressable onPress={state.onExample} hitSlop={10} accessibilityRole="button" accessibilityLabel="See an example of a polished photo">
                <Text style={styles.polishExample}>See example</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.polishDetail, short && styles.polishShort]} numberOfLines={1}>{detail}</Text>
        </View>
      </TouchableOpacity>
      <Switch value={on} onValueChange={() => state.onToggle(next)} trackColor={{ true: colors.primary }} accessibilityElementsHidden importantForAccessibility="no" />
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
        <Ionicons name="options-outline" size={17} color={colors.foreground} />
        <Text style={styles.batchText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Disabled is a solid stone bar with muted ink — it reads as "not yet", never
 * as a secondary button. Busy keeps full ink with a spinner so work in flight
 * doesn't look switched off.
 */
export function PrimaryButton({ label, icon, trailingIcon, onPress, disabled = false, busy = false, variant = 'primary' }: {
  disabled?: boolean; busy?: boolean; label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void;
  /** After the label, for an onward step ("Continue →"). */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  /** `secondary` is an ink outline: still a button, but not the finishing action. */
  variant?: 'primary' | 'secondary';
}) {
  const idle = disabled && !busy;
  const ink = idle ? colors.mutedForeground : variant === 'secondary' ? colors.foreground : colors.primaryForeground;
  return (
    <TouchableOpacity disabled={disabled || busy} accessibilityState={{ disabled: disabled && !busy, busy }} style={[styles.primary, variant === 'secondary' && styles.primaryOutline, idle && styles.primaryIdle]} onPress={onPress} accessibilityRole="button" activeOpacity={0.85}>
      {busy ? <ActivityIndicator size="small" color={ink} />
        : icon ? <Ionicons name={icon} size={17} color={ink} /> : null}
      <Animated.Text key={label} entering={FadeIn.duration(180)} style={[styles.primaryText, { color: ink }]}>{label}</Animated.Text>
      {trailingIcon && !busy ? <Ionicons name={trailingIcon} size={18} color={ink} /> : null}
    </TouchableOpacity>
  );
}

/** The bottom action bar's frame, shared by every review footer so they sit the same. */
export const actionBarStyle = {
  gap: spacing.xs,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.sm,
  borderTopWidth: stroke.hairline,
  borderTopColor: colors.hairline,
  backgroundColor: colors.background,
} as const;

const styles = StyleSheet.create({
  bar: actionBarStyle,
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
  // Disabled is a solid stone pair, not a faded black: readable, clearly inert.
  primaryIdle: { backgroundColor: colors.hairline, borderWidth: 0 },
  primaryOutline: { backgroundColor: 'transparent', borderWidth: stroke.fine, borderColor: colors.foreground },
  batch: { height: 56, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radii.xl, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', borderWidth: stroke.fine, borderColor: colors.foreground },
  batchText: { ...typography.text.label, color: colors.foreground },
  primaryText: { textAlign: 'center', ...typography.text.sectionTitle, color: colors.primaryForeground },
  secondary: { alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  polish: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.xs },
  polishMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  polishTitleLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  polishExample: { ...typography.text.caption, color: colors.inkSubtle, textDecorationLine: 'underline', textDecorationColor: colors.hairline },
  polishTitle: { ...typography.text.label, color: colors.foreground },
  polishDetail: { ...typography.text.caption, color: colors.mutedForeground },
  polishShort: { color: colors.destructive },
  busy: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  busyText: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
