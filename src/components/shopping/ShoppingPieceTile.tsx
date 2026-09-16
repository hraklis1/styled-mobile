import { touchShoppingImage } from '../../lib/shoppingImageCache';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { colors, spacing, typography } from '../../theme';
export function ShoppingPieceTile({
  item,
  onPress,
  onFavorite,
  selected,
  selecting,
  onLongPress,
}: {
  item: ShoppingEditItem;
  onPress: () => void;
  onFavorite: () => void;
  selected: boolean;
  selecting: boolean;
  onLongPress: () => void;
}) {
  const title = item.productName || item.category || 'Saved piece';
  return (
    <View style={styles.tile}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={`${title}, ${item.storeName ?? ''}`}
        accessibilityState={{ selected }}
      >
        <Image
          source={{ uri: item.primarySnap.imageUri }}
          style={[styles.image, selected && styles.selected]}
          contentFit="contain"
          cachePolicy="memory-disk"
          onLoad={() => touchShoppingImage(item.primarySnap.imageUri)}
          recyclingKey={item.primarySnap.id}
        />
        {selecting ? (
          <View style={styles.selection}>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={26}
              color={colors.primary}
            />
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.brand, item.storeName].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.price}>
          {formatShoppingPrice(
            item.extractedPrice,
            item.currencyCode ?? null,
          ) ?? 'Price not added'}
        </Text>
      </TouchableOpacity>
      {!selecting ? (
        <TouchableOpacity
          onPress={onFavorite}
          style={styles.favorite}
          accessibilityLabel={
            item.isFavorite ? 'Remove favorite' : 'Favorite piece'
          }
          accessibilityState={{ selected: item.isFavorite }}
        >
          <Ionicons
            name={item.isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  tile: { flex: 1, maxWidth: '48.5%', marginBottom: 24 },
  image: {
    width: '100%',
    aspectRatio: 0.8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 2,
  },
  selected: { borderWidth: 3, borderColor: colors.primary },
  title: {
    ...typography.text.cardTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  meta: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  price: {
    ...typography.text.bodySmall,
    color: colors.foreground,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  favorite: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selection: { position: 'absolute', right: 8, top: 8 },
});
