import { useContext } from 'react';
import { Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { OpenItemContext } from './stylistItemContext';
import { OCCASION_LABELS, normalizeOccasion } from '../../lib/attributes';
import { colors, spacing } from '../../theme';
import type { Item } from '../../types/item';
import { styles } from './ChatStyles';

// ── ItemDetailSheet ───────────────────────────────────────────────────────────

type ItemDetailSheetProps = {
  item: Item | null;
  onClose: () => void;
};

/** Stored occasions are slugs ("smart_casual"); show the shared display label. */
function occasionLabel(raw: string): string {
  const occasion = normalizeOccasion(raw);
  return occasion ? OCCASION_LABELS[occasion] : raw.replace(/_/g, ' ');
}

export function ItemDetailSheet({ item, onClose }: ItemDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const openItem = useContext(OpenItemContext);
  const imgUri = item ? itemImageUri(item) : null;
  const imageFit = itemImageContentFit(item);

  const metaRows = item
    ? ([
        item.category && { label: 'Category', value: item.category.replace(/_/g, ' ') },
        item.brand    && { label: 'Brand',    value: item.brand },
        item.color    && { label: 'Color',    value: item.color },
        item.style    && { label: 'Style',    value: item.style },
        item.occasions?.[0] && { label: 'Occasion', value: occasionLabel(item.occasions[0]) },
      ].filter(Boolean) as { label: string; value: string }[])
    : [];

  return (
    <Modal
      visible={!!item}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {item && (
        <View style={[styles.sheetRoot, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{item.name}</Text>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetImageWrap}>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={styles.sheetImage} resizeMode={imageFit} />
              ) : (
                <View style={styles.sheetImagePlaceholder}>
                  <Ionicons name="shirt-outline" size={48} color={colors.border} />
                </View>
              )}
            </View>

            {metaRows.length > 0 && (
              <View style={styles.sheetMeta}>
                {metaRows.map((row, i) => (
                  <View
                    key={row.label}
                    style={[styles.sheetMetaRow, i < metaRows.length - 1 && styles.sheetMetaRowBorder]}
                  >
                    <Text style={styles.sheetMetaLabel}>{row.label}</Text>
                    <Text style={styles.sheetMetaValue} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {openItem ? (
              <TouchableOpacity
                style={styles.sheetOpenItemBtn}
                onPress={() => {
                  const id = item.id;
                  onClose();
                  openItem(id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name} in Closet`}
              >
                <Text style={styles.sheetOpenItemText}>Open in Closet</Text>
                <Ionicons name="arrow-forward-outline" size={15} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}
