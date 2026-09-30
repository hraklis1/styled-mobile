import { useEffect } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, ingestion } from '../../../theme';

/**
 * The one inclusion mark, on the grid plate and the loupe hero alike. A
 * white ring keeps it legible on white linen and on navy alike.
 */
export function SelectBadge({ checked, onPress, disabled, reduceMotion, accessibilityLabel, style }: {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  reduceMotion: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
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
      <Animated.View style={[styles.badge, checked && styles.badgeOn, popStyle]}>
        {checked ? <Ionicons name="checkmark" size={15} color={colors.primaryForeground} /> : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Before extraction a tile's corner mark removes the piece outright; the
 * grid holds an Undo, so the tap needs no confirmation.
 */
export function RemoveBadge({ onPress, disabled, label, style }: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  // Neutral at rest so a grid of them stays quiet over the clothes; the
  // action colour arrives only under the finger, as the tap commits.
  return (
    <Pressable hitSlop={2} onPress={onPress} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} style={[styles.badgeTarget, style]}>
      {({ pressed }) => (
        <View style={[styles.badge, styles.remove, pressed && styles.removePressed]}>
          {!pressed ? <BlurView pointerEvents="none" tint="dark" intensity={30} style={StyleSheet.absoluteFill} /> : null}
          <Ionicons name="close" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: ingestion.badge.size,
    height: ingestion.badge.size,
    borderRadius: ingestion.badge.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: ingestion.badge.ring,
    borderColor: ingestion.badge.ringColor,
    backgroundColor: ingestion.badge.offFill,
  },
  badgeOn: { backgroundColor: colors.primary },
  remove: { overflow: 'hidden', backgroundColor: ingestion.badge.removeFill },
  removePressed: { backgroundColor: colors.destructive, transform: [{ scale: 0.92 }] },
});
