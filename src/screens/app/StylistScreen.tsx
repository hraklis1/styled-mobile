import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { openWishlist, wishlistSectionFromLegacy } from '../../navigation/savedRecommendations';
import { StylistChatView } from '../../components/stylist/StylistChatView';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, spacing } from '../../theme';
import { ActionButton } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { shoppingPriorityFromDailyLookGap } from '../../lib/dailyLookPresentation';
import type { StylistScreenProps } from '../../navigation/types';
import type { StylistMissingEssential } from '../../features/stylist/types';

export function StylistScreen({ navigation, route }: StylistScreenProps) {
  const { isPremium } = useEntitlement();
  const [openingPaywall, setOpeningPaywall] = useState(false);
  useEffect(() => {
    if (route.params?.view === 'saved' || route.params?.selectedId || route.params?.tab) {
      const { selectedId, tab } = route.params;
      navigation.setParams({ view: undefined, tab: undefined, selectedId: undefined });
      openWishlist(selectedId, wishlistSectionFromLegacy(tab), 'Stylist');
    } else if (route.params?.view) navigation.setParams({ view: undefined });
  }, [navigation, route.params]);
  const viewSaved = useCallback((selectedId: string) => openWishlist(selectedId, 'products', 'Stylist'), []);

  return <View style={styles.screen}>
    {isPremium ? <StylistChatView
      source="center_tab"
      threadMode="resume"
      openRequestId={1}
      embedded
      onViewSaved={viewSaved}
      onClose={() => navigation.navigate('Home')}
      onNavigateToCloset={(outfitId) => navigation.navigate('Closet', { screen: 'OutfitDetail', params: { outfitId, returnTo: 'Stylist' } })}
      onOpenItem={(itemId) => navigation.navigate('Closet', { screen: 'ItemDetail', params: { itemId } })}
      onNavigateToShop={(gap?: StylistMissingEssential) => {
        if (gap?.label) navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: { priority: shoppingPriorityFromDailyLookGap(gap) } });
      }}
    /> : <StylistPremiumGate openingPaywall={openingPaywall} onOpenPaywall={async () => {
      setOpeningPaywall(true);
      try { await presentPaywall(); } finally { setOpeningPaywall(false); }
    }} />}
  </View>;
}

function StylistPremiumGate({ openingPaywall, onOpenPaywall }: { openingPaywall: boolean; onOpenPaywall: () => Promise<void> }) {
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
        disabled={openingPaywall}
        onPress={() => void onOpenPaywall()}
        accessibilityLabel="See premium plans"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
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
