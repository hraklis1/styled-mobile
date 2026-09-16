import { StatusBar } from 'expo-status-bar';
import { useReducedMotion } from 'react-native-reanimated';
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { buildShopStylistLaunch } from '../../lib/shopDecisionWorkspace';
import { colors, typography } from '../../theme';
import { track } from '../../lib/analytics';
export function ShoppingCompare({
  items,
  onClose,
}: {
  items: ShoppingEditItem[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { openStylist } = useGlobalAIStylist();
  const ask = (question: string) => {
    track('shopping_comparison_stylist_opened', { piece_count: items.length });
    onClose();
    setTimeout(
      () =>
        openStylist({
          ...buildShopStylistLaunch(question),
          context: {
            kind: 'shopping_comparison',
            finds: items.map((item) => ({
              captureGroupId: item.captureGroupId,
              name: item.productName ?? item.category ?? 'Saved piece',
              storeName: item.storeName,
              price: item.extractedPrice,
              currencyCode: item.currencyCode ?? null,
              category: item.category,
              color: item.colorLabel,
              material: item.materialLabel,
              notes: item.notes,
            })),
          },
        }),
      300,
    );
  };
  return (
    <Modal
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Compare pieces</Text>
          <TouchableOpacity onPress={onClose} style={styles.button}>
            <Text>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal contentContainerStyle={{ padding: 16, gap: 12 }}>
          {items.map((item) => (
            <View key={item.id} style={{ width: 180 }}>
              <Image
                source={{ uri: item.primarySnap.imageUri }}
                style={{
                  width: 180,
                  height: 225,
                  backgroundColor: colors.surfaceSubtle,
                }}
                contentFit="contain"
              />
              <Text
                style={{
                  ...typography.text.cardTitle,
                  height: 60,
                  paddingTop: 12,
                }}
              >
                {item.productName ?? item.category ?? 'Saved piece'}
              </Text>
              {[
                [
                  'Price',
                  formatShoppingPrice(
                    item.extractedPrice,
                    item.currencyCode ?? null,
                  ),
                ],
                ['Store', item.storeName],
                ['Size', item.sizeLabel],
                ['Material', item.materialLabel],
                ['Fit notes', item.notes],
              ].map(([label, value]) => (
                <View key={label} style={styles.cell}>
                  <Text style={styles.label}>{label}</Text>
                  <ScrollView nestedScrollEnabled>
                    <Text selectable style={styles.value}>
                      {value || 'Not added'}
                    </Text>
                  </ScrollView>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={styles.label}>ASK YOUR STYLIST</Text>
          {[
            'Which fills a wardrobe gap?',
            'Which works with more of my clothes?',
          ].map((question) => (
            <TouchableOpacity
              key={question}
              style={styles.ask}
              onPress={() => ask(question)}
            >
              <Text style={styles.value}>{question}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  button: { padding: 16 },
  cell: {
    height: 100,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 6,
  },
  label: { ...typography.text.caption, color: colors.mutedForeground },
  value: { ...typography.text.body, color: colors.foreground },
  ask: { padding: 16, backgroundColor: colors.surfaceSubtle, borderRadius: 8 },
});
