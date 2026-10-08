import { StyleSheet, View } from 'react-native';
import { colors, spacing, stroke } from '../../../theme';
import { PrimaryButton } from './PrimaryButton';
import { TextLink } from './atoms';

/**
 * The primary label for a one-piece-at-a-time walk, shared by the closet
 * scan's loupe and the outfit log's resolve sheet. An edit outside the walk
 * saves; the last step finishes in the flow's own words.
 */
export function guidedLabel({ editing = false, last, lastLabel }: { editing?: boolean; last: boolean; lastLabel: string }) {
  return editing ? 'Save' : last ? lastLabel : 'Confirm & next';
}

/**
 * The anchored footer of a guided walk: Skip, quiet, on the left; the
 * confirming action filling the rest of the thumb row. Always present, so
 * the footer never jumps between steps.
 */
export function GuidedFooter({ label, disabled, onConfirm, onSkip, bordered = false }: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void;
  /** Omitted when there is nothing to skip to. */
  onSkip?: (() => void) | null;
  /** A hairline above, when it sits under scrolling content rather than in a bar. */
  bordered?: boolean;
}) {
  return (
    <View style={[styles.row, bordered && styles.bordered]}>
      {onSkip ? <View style={styles.skip}><TextLink label="Skip" tone="muted" onPress={onSkip} accessibilityLabel="Skip this piece" /></View> : null}
      <View style={styles.primary}><PrimaryButton label={label} disabled={disabled} onPress={onConfirm} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bordered: { paddingTop: spacing.sm, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  skip: { minWidth: 64, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1 },
});
