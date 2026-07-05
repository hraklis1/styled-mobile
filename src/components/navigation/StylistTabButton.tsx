import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { colors } from '../../theme';

// Elevated circular center tab for the AI Stylist. Raise kept ≤18px with top
// hitSlop so the protruding half still registers touches on Android, where the
// bar doesn't extend its touchable bounds.
export function StylistTabButton({
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityLabel,
  testID,
}: BottomTabBarButtonProps) {
  const selected = accessibilityState?.selected === true;

  return (
    <Pressable
      style={styles.wrap}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={{ top: 16 }}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={[styles.circle, selected && styles.circleSelected]}>
        <Ionicons name="sparkles" size={24} color={colors.primaryForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.foreground,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  circleSelected: {
    shadowOpacity: 0.22,
  },
});
