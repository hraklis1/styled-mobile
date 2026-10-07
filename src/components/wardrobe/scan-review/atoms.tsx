import { Fragment } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, stroke, typography } from '../../../theme';

const HIT = { top: 8, bottom: 8, left: 6, right: 6 };

/**
 * The one mark for "worth a look". Walnut ink is the palette's single warm
 * note, reserved for small signals, so it reads as a pencil tick in the
 * margin rather than a warning.
 */
export function FlagDot({ size = 6, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentInk }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export function TextLink({ label, onPress, tone = 'ink', weight = 'regular', disabled, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'muted';
  /** `strong` for a sheet's confirming action (Done, Save). */
  weight?: 'regular' | 'strong';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT}
      style={styles.link}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.linkText, weight === 'strong' && styles.linkStrong, tone === 'muted' && styles.linkMuted, disabled && styles.linkDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * A list-height action row — a ringed glyph and a label — for actions that
 * belong to a list ("Add missing piece") rather than float below it.
 */
export function GhostRow({ label, icon = 'add', onPress, disabled, accessibilityLabel }: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.6} style={[styles.ghostRow, disabled && styles.linkDisabled]}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }}>
      <View style={styles.ghostIcon}><Ionicons name={icon} size={16} color={colors.foreground} /></View>
      <Text style={styles.ghostLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * A full-width outlined pill for a secondary list action ("Add another
 * piece") — a control, so rounded; quieter than the primary bar below it.
 */
export function OutlinePill({ label, icon = 'add', onPress, disabled, accessibilityLabel }: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.6} style={[styles.pill, disabled && styles.linkDisabled]}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }}>
      <Ionicons name={icon} size={16} color={colors.foreground} />
      <Text style={styles.pillLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A middot between quiet text controls. */
export function Middot() {
  return <Text style={styles.middot} accessibilityElementsHidden importantForAccessibility="no">·</Text>;
}

/** Two or three words, the chosen one underlined — a switch set as type. */
export function TextSegment<T extends string>({ options, value, onChange, disabled, accessibilityLabel }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Fragment key={option.value}>
            {index > 0 ? <View style={styles.segmentRule} /> : null}
            <TouchableOpacity
              onPress={() => { if (!selected) onChange(option.value); }}
              disabled={disabled}
              hitSlop={HIT}
              style={styles.link}
              accessibilityRole="tab"
              accessibilityState={{ selected, disabled }}
            >
              <Text style={[styles.linkText, !selected && styles.linkMuted, selected && styles.segmentSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          </Fragment>
        );
      })}
    </View>
  );
}

/**
 * Text-first chip: an outline and a word, never a filled block. Selection
 * darkens the stroke and the word and adds a small tick, so a row of five
 * still reads as a caption line.
 */
export function QuietChip({ label, selected, onPress, disabled }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
    >
      {selected ? <Ionicons name="checkmark" size={11} color={colors.foreground} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow<T extends string>({ label, options, isSelected, onToggle, disabled }: {
  label: string;
  options: readonly { value: T; label: string }[];
  isSelected: (value: T) => boolean;
  onToggle: (value: T) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipRowLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <QuietChip
            key={option.value}
            label={option.label}
            selected={isSelected(option.value)}
            onPress={() => onToggle(option.value)}
            disabled={disabled}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.text.meta, fontWeight: typography.weight.medium, color: colors.foreground },
  linkMuted: { color: colors.mutedForeground },
  linkStrong: { fontWeight: typography.weight.semibold },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 48, borderRadius: radii.action, borderWidth: stroke.fine, borderColor: colors.controlOutline },
  pillLabel: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.foreground },
  ghostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
  ghostIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: stroke.fine, borderColor: colors.controlOutline, alignItems: 'center', justifyContent: 'center' },
  ghostLabel: { ...typography.text.bodySmall, color: colors.foreground },
  linkDisabled: { opacity: 0.4 },
  middot: { ...typography.text.meta, color: colors.tertiary, paddingHorizontal: spacing.sm },
  segment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segmentRule: { width: stroke.hairline, height: 12, backgroundColor: colors.controlOutline },
  segmentSelected: { textDecorationLine: 'underline', textDecorationColor: colors.foreground },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
  },
  chipSelected: { borderColor: colors.foreground },
  chipText: { ...typography.text.bodySmall, color: colors.mutedForeground },
  chipTextSelected: { color: colors.foreground, fontWeight: typography.weight.medium },
  chipRow: { gap: spacing.sm },
  chipRowLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
