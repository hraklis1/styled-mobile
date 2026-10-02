import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, curatedProducts, spacing, typography } from '../../theme';
import type { OfferContext, OfferStatus, ProductOffer } from '../../types/commerce';
import { productDisclosure, productKey } from '../../lib/productPresentation';

export function CuratedProductBrowser({ visible, title, reason, offers, status, context, onRetry, onClose, renderCard, error }: {
  visible: boolean; title: string; reason?: string; offers: ProductOffer[]; status: OfferStatus;
  context: OfferContext; onRetry?: () => void; onClose: () => void;
  renderCard: (offer: ProductOffer, width: number) => ReactNode; error?: string | null;
}) {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const contentWidth = width - spacing.page * 2 - insets.left - insets.right;
  const twoColumns = fontScale <= curatedProducts.gridFontScaleLimit && (contentWidth - spacing.md) / 2 >= curatedProducts.minWidth;
  const cardWidth = twoColumns ? (contentWidth - spacing.md) / 2 : contentWidth;
  return <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]} accessibilityViewIsModal>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>THE SHOPPING EDIT</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close product options" style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Ionicons name="close" size={22} color={colors.foreground} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {reason ? <Text style={styles.reason}>{reason}</Text> : null}
        <Text style={styles.count}>{offers.length} {offers.length === 1 ? 'piece' : 'pieces'} to consider</Text>
        {error ? <Text style={styles.copy} accessibilityRole="alert">{error}</Text> : null}
        {offers.some(offer => offer.monetized) ? <Text style={styles.copy}>{productDisclosure}</Text> : null}
        <View style={styles.grid}>{offers.map(offer => <View key={productKey(offer)} style={{ width: cardWidth }}>{renderCard(offer, cardWidth)}</View>)}</View>
        {!offers.length ? <Text style={styles.copy}>{status === 'pending' ? 'Finding considered pieces…' : status === 'unavailable' ? 'Shopping options are unavailable right now.' : 'No suitable listings right now. Your styling guide is still here.'}</Text> : null}
        {status === 'unavailable' && onRetry ? <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={`Retry ${context.targetKey} options`} style={styles.retry}><Text style={styles.copy}>Try again</Text></Pressable> : null}
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.page, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...typography.text.masthead, color: colors.accentInk, flexShrink: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.5 },
  content: { paddingHorizontal: spacing.page, gap: spacing.md },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  reason: { ...typography.text.editorialItalic, color: colors.inkSubtle },
  count: { ...typography.text.caption, color: colors.mutedForeground },
  copy: { ...typography.text.bodySmall, color: colors.mutedForeground },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-start' },
  retry: { minHeight: 44, justifyContent: 'center' },
});
