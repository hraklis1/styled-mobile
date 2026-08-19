import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import type { ProfileOption } from '../../lib/profileOptions';

/**
 * The one selection control for profile-shaped questions.
 *
 * It exists because a tester reported that "colour palette, style preference,
 * budget" would not take more than one answer — and half of that was a
 * rendering problem, not a data one. Style preference HAD been multi-select all
 * along; nothing on screen said so, so nobody tried a second tap. Every group
 * here states its own rule ("Select all that apply" / "Choose one") and, when
 * multi, counts what you have picked.
 *
 * It also replaces four near-identical implementations that had each drifted:
 * onboarding's `SelectPill`/`SelectCard`, and ProfileScreen's
 * `OptionChips`/`SingleChips`. The visual language follows `ChoiceChips` in
 * ShopWishlistFilterSheet, which was the most resolved of them.
 *
 * Deliberately NOT unified with `FilterPanel`, `TaxonomySelector` or
 * `CategoryFilterPills` — those are closet-filtering controls with their own
 * density and behaviour.
 */

type BaseProps = {
  options: readonly ProfileOption[];
  /** 'pill' for short labels, 'card' when options carry descriptions, 'swatch' for palettes. */
  layout?: 'pill' | 'card' | 'swatch';
  /** Overrides the automatic "Select all that apply" / "Choose one" caption. Pass null to hide it. */
  caption?: string | null;
  style?: StyleProp<ViewStyle>;
};

type SingleProps = BaseProps & {
  mode: 'single';
  value: string;
  onChange: (value: string) => void;
  /** Tapping the selected option clears it. Defaults to true. */
  clearable?: boolean;
  max?: never;
};

type MultiProps = BaseProps & {
  mode: 'multi';
  values: string[];
  onChange: (values: string[]) => void;
  /** Cap on selections. At the cap, unselected options go inert rather than disappearing. */
  max?: number;
  clearable?: never;
};

type Props = SingleProps | MultiProps;

function toggle(values: readonly string[], id: string): string[] {
  return values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
}

export function SelectionGroup(props: Props) {
  const { options, layout = 'pill', caption, style } = props;
  const selected = props.mode === 'multi' ? props.values : props.value ? [props.value] : [];
  const atCap = props.mode === 'multi' && props.max != null && selected.length >= props.max;

  const captionText = useMemo(() => {
    if (caption !== undefined) return caption;
    if (props.mode === 'single') return 'Choose one';
    if (props.max != null) return `Select all that apply · ${selected.length} of ${props.max}`;
    return selected.length > 0
      ? `Select all that apply · ${selected.length} selected`
      : 'Select all that apply';
  }, [caption, props.mode, props.max, selected.length]);

  const handlePress = (value: string) => {
    if (props.mode === 'multi') {
      if (atCap && !selected.includes(value)) return;
      props.onChange(toggle(props.values, value));
      return;
    }
    const clearable = props.clearable ?? true;
    props.onChange(clearable && props.value === value ? '' : value);
  };

  return (
    <View style={style}>
      {captionText ? <Text style={s.caption}>{captionText}</Text> : null}
      <View style={layout === 'pill' ? s.pillWrap : s.grid}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          const inert = atCap && !isSelected;

          return (
            <PressableScale
              key={option.value}
              onPress={() => handlePress(option.value)}
              disabled={inert}
              scaleTo={0.97}
              accessibilityRole={props.mode === 'multi' ? 'checkbox' : 'radio'}
              accessibilityState={
                props.mode === 'multi'
                  ? { checked: isSelected, disabled: inert }
                  : { selected: isSelected }
              }
              accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
              style={layout === 'pill' ? undefined : s.gridCell}
              contentStyle={[
                s.base,
                layout === 'pill' && s.pill,
                layout === 'card' && s.card,
                layout === 'swatch' && s.swatchCard,
                isSelected && s.selected,
                isSelected && shadows.xs,
                inert && s.inert,
              ]}
            >
              {layout === 'swatch' && (
                <View style={s.swatchStack}>
                  {(option as { colors?: string[] }).colors?.map((c) => (
                    <View key={c} style={[s.swatchSegment, { backgroundColor: c }]} />
                  ))}
                </View>
              )}

              {isSelected && layout !== 'swatch' && (
                <Ionicons
                  name={props.mode === 'multi' ? 'checkmark' : 'checkmark-circle'}
                  size={layout === 'card' ? 15 : 13}
                  color={colors.primary}
                  style={layout === 'card' ? s.cardCheck : undefined}
                />
              )}

              <View style={layout === 'pill' ? undefined : s.cardText}>
                <Text style={[s.label, isSelected && s.labelSelected]}>{option.label}</Text>
                {option.description && layout === 'card' ? (
                  <Text style={s.description}>{option.description}</Text>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caption: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Layout lives on the Pressable, visuals on the Animated.View it wraps —
  // otherwise the width reflows mid-spring. See PressableScale's own note.
  gridCell: { width: '48%' },
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
  },
  card: {
    minHeight: 84,
    padding: spacing.md,
    borderRadius: radii.xl,
    justifyContent: 'flex-end',
  },
  swatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    padding: spacing.md,
    borderRadius: radii.xl,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  inert: { opacity: 0.35 },
  cardCheck: { marginBottom: spacing.xs },
  cardText: { gap: 2 },
  label: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  labelSelected: {
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  description: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.caption.fontSize * typography.lineHeight.normal,
  },
  // A full five-stop stack, not one dot: the point of a palette is the
  // relationship between its colours.
  swatchStack: {
    flexDirection: 'row',
    width: 44,
    height: 30,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  swatchSegment: { flex: 1 },
});
