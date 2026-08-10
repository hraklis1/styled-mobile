import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../primitives/PressableScale';
import { colors, spacing, typography } from '../../theme';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack: () => void;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Consistent in-app header for Shop stack pages (the native header is hidden). */
export function ShopSubpageHeader({ title, subtitle, eyebrow = 'SHOP', onBack, actions, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }, style]}>
      <View style={styles.topRow}>
        <PressableScale
          contentStyle={styles.backButton}
          onPress={onBack}
          haptic={false}
          accessibilityRole="button"
          accessibilityLabel="Back to Shop"
        >
          <Ionicons name="chevron-back" size={23} color={colors.foreground} />
        </PressableScale>
        <View style={styles.actions}>{actions}</View>
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.card },
  topRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.surfaceElevated },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { fontSize: 11, fontWeight: typography.weight.bold, letterSpacing: 2.1, color: colors.primary },
  title: { maxWidth: 340, paddingTop: spacing.sm, fontFamily: typography.family.display, fontSize: 34, lineHeight: 39, color: colors.foreground },
  subtitle: { maxWidth: 340, paddingTop: spacing.sm, fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
});
