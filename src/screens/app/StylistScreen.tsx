import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { StylistChatView } from '../../components/stylist/StylistChatView';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, spacing } from '../../theme';
import { ActionButton } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { shoppingPriorityFromDailyLookGap } from '../../lib/dailyLookPresentation';
import type { AppTabParamList } from '../../navigation/types';
import type { StylistMissingEssential } from '../../features/stylist/types';

export function StylistScreen() {
  const { isPremium } = useEntitlement();
  const [openingPaywall, setOpeningPaywall] = useState(false);
  // From a root tab there's no modal to dismiss, so "Done" exits the stylist by
  // returning to Home — restoring the close affordance users expect top-right.
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();

  if (isPremium) {
    return (
      <StylistChatView
        source="center_tab"
        threadMode="resume"
        openRequestId={1}
        embedded
        onClose={() => navigation.navigate('Home')}
        onNavigateToCloset={(outfitId) => navigation.navigate('Closet', {
          screen: 'OutfitDetail',
          params: { outfitId },
        })}
        onNavigateToShop={(gap?: StylistMissingEssential) => {
          if (!gap?.label) return;
          navigation.navigate('Shop', {
            screen: 'ShoppingPriorityEdit',
            params: { priority: shoppingPriorityFromDailyLookGap(gap) },
          });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Ionicons name="sparkles" size={28} color={colors.primary} />
      </View>
      <AppText variant="eyebrowLarge" tone="brand" style={styles.eyebrow}>PRIVATE STYLING</AppText>
      <AppText variant="editorialHero" tone="primary" style={styles.title}>A stylist who already knows your wardrobe.</AppText>
      <AppText variant="body" tone="secondary" style={styles.body}>
        Build looks, plan for events, spot wardrobe gaps, and shop with more intention.
      </AppText>
      <ActionButton
        label={openingPaywall ? 'Opening...' : 'Meet your stylist'}
        icon="sparkles"
        style={styles.button}
        onPress={async () => {
          if (openingPaywall) return;
          setOpeningPaywall(true);
          try { await presentPaywall(); } finally { setOpeningPaywall(false); }
        }}
        accessibilityLabel="See premium plans"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.background,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSelected,
  },
  eyebrow: { marginTop: spacing.sm },
  title: {
    textAlign: 'center',
  },
  body: {
    maxWidth: 340,
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    minWidth: 220,
    marginTop: spacing.md,
  },
});
