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
  /** Pass null to drop the eyebrow — for a title that already says it all. */
  eyebrow?: string | null;
  /** Quiet counterpart at the right end of the eyebrow line ("03 directions",
   *  "Step 2 of 4") — bookkeeping that belongs with the label, not the deck. */
  eyebrowTrailing?: string;
  onBack: () => void;
  actions?: ReactNode;
  compact?: boolean;
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  style?: StyleProp<ViewStyle>;
};

/** Consistent in-app header for Shop stack pages (the native header is hidden). */
export function ShopSubpageHeader({ title, subtitle, eyebrow = 'SHOP', eyebrowTrailing, onBack, actions, compact = false, titleNumberOfLines, subtitleNumberOfLines, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, compact && styles.headerCompact, { paddingTop: insets.top + spacing.md }, style]}>
      <View style={[styles.topRow, compact && styles.topRowCompact]}>
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
      {compact && (
        <View style={styles.compactTitleWrap}>
          {eyebrow ? <AppText variant="eyebrow" tone="brand">{eyebrow}</AppText> : null}
          <AppText variant="sectionTitle" tone="primary" numberOfLines={1}>{title}</AppText>
          {subtitle ? <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText> : null}
        </View>
      )}
      {!compact && (
        <>
          {eyebrow ? (
            <View style={styles.eyebrowRow}>
              <AppText variant="eyebrowLarge" tone="brand">{eyebrow}</AppText>
              {eyebrowTrailing ? <AppText variant="meta" tone="muted">{eyebrowTrailing}</AppText> : null}
            </View>
          ) : null}
          <AppText variant="editorialHero" tone="primary" style={styles.title} numberOfLines={titleNumberOfLines}>{title}</AppText>
          {subtitle ? <AppText variant="bodySmall" tone="secondary" style={styles.subtitle} numberOfLines={subtitleNumberOfLines}>{subtitle}</AppText> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Page ground, not a tinted plate: Shop's subpages are one continuous
  // sheet, sectioned by single hairlines rather than by changes of surface.
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.background },
  headerCompact: { paddingBottom: spacing.md },
  topRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  topRowCompact: { minHeight: 42, marginBottom: spacing.sm },
  compactTitleWrap: { gap: 1 },
  // Outlined, not filled: on the page ground a white disc had nothing to sit
  // against, and a tinted one vanished. A hairline ring reads as a control
  // without adding a surface.
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.background },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  title: { maxWidth: 340, paddingTop: spacing.sm },
  subtitle: { maxWidth: 340, paddingTop: spacing.sm },
});
