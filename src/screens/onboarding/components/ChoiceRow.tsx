import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '../../../theme';

/** A large single-line choice with a line icon; enters staggered by `index`. */
export function ChoiceRow({
  label,
  icon,
  selected,
  dimmed,
  index,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  dimmed?: boolean;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(260).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        // Dim here, not on the animated wrapper: its entering animation owns opacity.
        style={({ pressed }) => [s.row, selected && s.rowSelected, dimmed && s.dimmed, pressed && s.pressed]}
      >
        <Ionicons name={icon} size={20} color={colors.foreground} />
        <Text style={s.label}>{label}</Text>
        <View style={[s.check, selected && s.checkOn]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.primaryForeground} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  rowSelected: { borderColor: colors.foreground, borderWidth: 1.5 },
  dimmed: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: { flex: 1, fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.foreground, borderColor: colors.foreground },
});
