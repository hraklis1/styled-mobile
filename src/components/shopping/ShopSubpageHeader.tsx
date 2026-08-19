import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../primitives/PressableScale';
import { AppText } from '../primitives/AppText';
import { colors, spacing } from '../../theme';

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
              <AppText variant="eyebrow" tone="brand">{eyebrow}</AppText>
              <AppText variant="sectionTitle" tone="primary" numberOfLines={1}>{title}</AppText>
              {subtitle ? <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText> : null}
            </View>
          )}
        </View>
        <View style={styles.actions}>{actions}</View>
      </View>
      {!compact && (
        <>
          <AppText variant="eyebrowLarge" tone="brand">{eyebrow}</AppText>
          <AppText variant="editorialHero" tone="primary" style={styles.title} numberOfLines={titleNumberOfLines}>{title}</AppText>
          {subtitle ? <AppText variant="bodySmall" tone="secondary" style={styles.subtitle} numberOfLines={subtitleNumberOfLines}>{subtitle}</AppText> : null}
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
  compactEyebrow: {},
  compactTitle: {},
  compactSubtitle: {},
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.surfaceElevated },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: {},
  title: { maxWidth: 340, paddingTop: spacing.sm },
  subtitle: { maxWidth: 340, paddingTop: spacing.sm },
});
