import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, shadows, spacing, typography } from '../../theme';

type Props = { onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> };

export function AddToClosetCard({ onPress, disabled = false, style }: Props) {
  return (
    <PressableScale
      style={style} contentStyle={[styles.surface, disabled && styles.disabled]}
      pressedContentStyle={styles.pressed} motion="crisp" scaleTo={0.985} haptic={false}
      onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel="Add to my closet" accessibilityState={{ disabled }}
      accessibilityHint="Opens options to take a photo, choose from your library, or import several pieces"
    >
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="camera-outline" size={22} color={colors.primary} />
        <View style={styles.badge}><Ionicons name="add" size={11} color={colors.primaryForeground} /></View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Add to my closet</Text>
        <Text style={styles.subtitle}>Photograph or import pieces you own</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.primary} accessible={false} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radii.card, borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated, ...shadows.actionCard,
  },
  icon: { width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: radii.panel, backgroundColor: colors.surfaceSubtle },
  badge: { position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: radii.full, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.text.actionTitle, color: colors.foreground },
  subtitle: { ...typography.text.bodySmall, color: colors.mutedForeground },
  pressed: { backgroundColor: colors.surfaceSubtle },
  disabled: { opacity: 0.5 },
});
