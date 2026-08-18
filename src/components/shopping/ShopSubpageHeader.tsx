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
  compact?: boolean;
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  style?: StyleProp<ViewStyle>;
};

/** Consistent in-app header for Shop stack pages (the native header is hidden). */
export function ShopSubpageHeader({ title, subtitle, eyebrow = 'SHOP', onBack, actions, compact = false, titleNumberOfLines, subtitleNumberOfLines, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, compact && styles.headerCompact, { paddingTop: insets.top + spacing.md }, style]}>
      <View style={[styles.topRow, compact && styles.topRowCompact]}>
        <View style={compact ? styles.compactTitleRow : undefined}>
          <PressableScale
            contentStyle={styles.backButton}
            onPress={onBack}
            haptic={false}
            accessibilityRole="button"
            accessibilityLabel="Back to Shop"
          >
            <Ionicons name="chevron-back" size={23} color={colors.foreground} />
          </PressableScale>
          {compact && (
            <View style={styles.compactTitleWrap}>
              <Text style={styles.compactEyebrow}>{eyebrow}</Text>
              <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={styles.compactSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
          )}
        </View>
        <View style={styles.actions}>{actions}</View>
      </View>
      {!compact && (
        <>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title} numberOfLines={titleNumberOfLines}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={subtitleNumberOfLines}>{subtitle}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.card },
  headerCompact: { paddingBottom: spacing.sm },
  topRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  topRowCompact: { minHeight: 52, marginBottom: 0 },
  compactTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compactTitleWrap: { flex: 1, minWidth: 0, gap: 1 },
  compactEyebrow: { ...typography.eyebrow, color: colors.primary },
  compactTitle: { fontFamily: typography.family.display, ...typography.display.sm, color: colors.foreground },
  compactSubtitle: { fontSize: typography.size.xs, lineHeight: 15, color: colors.mutedForeground },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.surfaceElevated },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { ...typography.eyebrowLarge, color: colors.primary },
  title: { maxWidth: 340, paddingTop: spacing.sm, fontFamily: typography.family.display, ...typography.display.lg, color: colors.foreground },
  subtitle: { maxWidth: 340, paddingTop: spacing.sm, fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
});
