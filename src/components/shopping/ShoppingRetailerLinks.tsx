import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { track } from '../../lib/analytics';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';

export async function openShoppingLink(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    Alert.alert('Link unavailable', 'Please try another retailer.');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert('Couldn’t open this link', 'Check your connection and try again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Try again',
        onPress: () => {
          void openShoppingLink(url);
        },
      },
    ]);
  }
}
export function ShoppingRetailerLinks({ target }: { target: ShoppingPriorityTarget }) {
  const direct = target.productUrl && !target.offers?.length;
  const retailers = [...new Set(target.retailerExamples ?? [])];
  if (!direct && !retailers.length) return null;
  return (
    <View style={styles.section}>
      {!direct ? <Text style={styles.copy}>Find similar styles from these retailers on Google Shopping.</Text> : null}
      {(direct ? [target.merchant || 'View product'] : retailers).map((retailer) => (
        <PressableScale
          key={retailer}
          haptic={false}
          contentStyle={styles.row}
          accessibilityRole="link"
          accessibilityLabel={
            direct
              ? `View ${target.title} at ${retailer}`
              : `Search ${retailer} on Google Shopping for ${target.title}`
          }
          onPress={() => {
            track(direct ? 'shopping_brief_product_opened' : 'shopping_brief_retailer_searched', {
              targetKey: target.key,
              retailer,
            });
            void openShoppingLink(
              direct
                ? target.productUrl!
                : `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${retailer} ${target.title}`)}`,
            );
          }}
        >
          <Text style={styles.link}>
            {direct ? retailer : `Search ${retailer} on Google Shopping`}
          </Text>
          <Ionicons name="open-outline" size={16} color={shoppingSurfaces.olive.accent} />
        </PressableScale>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  copy: { ...typography.text.bodySmall, color: colors.inkSubtle },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  link: { ...typography.text.label, flex: 1, color: shoppingSurfaces.olive.accent },
});
