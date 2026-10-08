import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii } from '../../theme';

/**
 * The one selection mark across closet cards and rows: a filled ink disc with
 * a check when selected, an open ring when not. `onPhoto` draws the ring white
 * with a shadow so it holds on any garment photo.
 */
export function SelectionCheck({ selected, onPhoto = false, style }: { selected: boolean; onPhoto?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
      style={[styles.base, onPhoto && styles.onPhoto, selected ? styles.on : onPhoto ? styles.offPhoto : styles.offSurface, style]}
      pointerEvents="none"
    >
      {selected && <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { width: 24, height: 24, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  onPhoto: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  on: { backgroundColor: colors.primary, borderColor: colors.white },
  offPhoto: { backgroundColor: 'rgba(255,255,255,0.35)', borderColor: colors.white },
  offSurface: { backgroundColor: 'transparent', borderColor: colors.controlOutline },
});
