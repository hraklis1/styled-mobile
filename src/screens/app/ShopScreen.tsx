import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ScreenHeader } from '../../components/primitives/Editorial';
import { SavedRecommendationsContent } from '../../components/stylist/SavedRecommendationsContent';
import { wishlistSectionFromLegacy } from '../../navigation/savedRecommendations';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { colors, spacing } from '../../theme';
import type { SavedLooksScreenProps, SavedShoppingScreenProps, SavedShoppingTab, WishlistScreenProps } from '../../navigation/types';

function useSavedRedirect(navigation: SavedShoppingScreenProps['navigation'], tab: SavedShoppingTab, selectedId?: string) {
  useEffect(() => {
    navigation.replace('Wishlist', { section: wishlistSectionFromLegacy(tab), selectedId });
  }, [navigation, selectedId, tab]);
}

export function SavedShoppingScreen({ navigation, route }: SavedShoppingScreenProps) {
  useSavedRedirect(navigation, route.params?.tab ?? 'all', route.params?.selectedId);
  return null;
}

export function SavedLooksScreen({ navigation, route }: SavedLooksScreenProps) {
  useSavedRedirect(navigation as SavedShoppingScreenProps['navigation'], 'looks', route.params?.selectedId);
  return null;
}

export function WishlistScreen({ navigation, route }: WishlistScreenProps) {
  const active = useIsFocused();
  const { resumeStylist } = useGlobalAIStylist();
  const consumeSelection = useCallback(() => navigation.setParams({ selectedId: undefined }), [navigation]);
  const consumeSection = useCallback(() => navigation.setParams({ section: undefined }), [navigation]);
  const returnTo = route.params?.returnTo;
  useEffect(() => navigation.addListener('beforeRemove', () => {
    if (returnTo === 'stylist-modal') requestAnimationFrame(resumeStylist);
    else if (returnTo === 'Stylist') requestAnimationFrame(() => navigation.getParent()?.navigate('Stylist'));
  }), [navigation, resumeStylist, returnTo]);
  return <View style={styles.screen}>
    <ScreenHeader title="Wishlist" primaryAction={{ label: 'Back', icon: 'arrow-back', variant: 'secondary', onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.replace('ShopMain') }} />
    <SavedRecommendationsContent active={active} initialSection={route.params?.section} selectedId={route.params?.selectedId} onTabConsumed={consumeSection} onSelectionConsumed={consumeSelection} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background, paddingBottom: spacing.xs } });
