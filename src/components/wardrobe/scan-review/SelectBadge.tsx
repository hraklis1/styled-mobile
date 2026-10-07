import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors } from '../../../theme';

/**
 * The one inclusion mark, on the grid plate and the loupe hero alike. A
 * white ring keeps it legible on white linen and on navy alike.
 */
export function SelectBadge({ checked, onPress, disabled, reduceMotion, accessibilityLabel, style, variant = 'photo' }: {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  reduceMotion: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  /** `photo` sits on imagery and needs its lift; `plain` sits on cream and doesn't. */
  variant?: 'photo' | 'plain';
}) {
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) pop.value = withSequence(withTiming(0.85, { duration: 70 }), withTiming(1, { duration: 140 }));
  }, [checked, pop, reduceMotion]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <TouchableOpacity hitSlop={2} onPress={onPress} disabled={disabled} activeOpacity={0.8}
      accessibilityRole="checkbox" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }} style={[styles.badgeTarget, style]}>
      <Animated.View style={[styles.badge, variant === 'plain' && styles.badgePlain, checked && styles.badgeOn, popStyle]}>
        {checked ? <Ionicons name="checkmark" size={variant === 'plain' ? 12 : 13} color={colors.primaryForeground} /> : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badgeTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    // Off: an ink ring on a white disc, so an empty slot reads on pale plates and dark photos alike.
    borderWidth: 1.5,
    borderColor: colors.foreground,
    backgroundColor: colors.white,
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  },
  // Flat and a touch smaller; the 48pt target is unchanged.
  badgePlain: { width: 20, height: 20, borderRadius: 10, boxShadow: 'none', borderColor: colors.controlOutline, backgroundColor: 'transparent' },
  badgeOn: { backgroundColor: colors.foreground, borderColor: colors.foreground },
});
