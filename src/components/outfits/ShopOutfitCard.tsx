import { useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShopOutfit, ShopOutfitItem } from '../../types/shop';

type Props = {
  outfit: ShopOutfit;
  /** Show a remove button instead of save (used in ShopScreen wishlist) */
  onRemove?: () => void;
  /** Called after user taps Save — pass undefined to hide the button */
  onSave?: () => Promise<void>;
  /** Override the default "Save" button label (e.g. "Save for <event>") */
  saveLabel?: string;
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  top: 'shirt-outline',
  bottom: 'pricetag-outline',
  shoes: 'footsteps-outline',
  outerwear: 'partly-sunny-outline',
  accessory: 'diamond-outline',
};

const CATEGORY_COLOR: Record<string, string> = {
  top: '#2563EB',
  bottom: '#78716C',
  shoes: '#D97706',
  outerwear: '#16A34A',
  accessory: '#7C3AED',
};

const CATEGORY_LABEL: Record<string, string> = {
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  outerwear: 'Outer',
  accessory: 'Acc.',
};

function shopUrl(item: ShopOutfitItem) {
  return item.retailerUrl || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${item.brand} ${item.name}`)}`;
}

function ProductCard({ item, width }: { item: ShopOutfitItem; width: number }) {
  const cat = item.category?.toLowerCase() ?? 'top';
  const iconName = CATEGORY_ICON[cat] ?? 'bag-outline';
  const accentColor = CATEGORY_COLOR[cat] ?? colors.primary;
  const label = CATEGORY_LABEL[cat] ?? item.category;

  return (
    <View style={[styles.productCard, { width }]}>
      <View style={styles.productImageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productFallback, { backgroundColor: `${accentColor}10` }]}>
            <Ionicons name={iconName} size={32} color={accentColor} />
            <Text style={[styles.categoryLabel, { color: accentColor }]}>{label}</Text>
          </View>
        )}
        <View style={styles.priceBadge}><Text style={styles.itemPrice}>{item.priceRange}</Text></View>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemBrand}>{item.brand.toUpperCase()}</Text>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemWhy} numberOfLines={2}>{item.whyItFitsYou}</Text>
        <TouchableOpacity
          style={styles.shopLink}
          onPress={() => Linking.openURL(shopUrl(item))}
          accessibilityLabel={`Shop ${item.name} by ${item.brand}`}
        >
          <Text style={styles.shopLinkText}>View at retailer</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ShopOutfitCard({ outfit, onRemove, onSave, saveLabel }: Props) {
  const { width } = useWindowDimensions();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const city = outfit.city?.trim();
  const productWidth = Math.min(252, width - 72);

  async function handleSave() {
    if (!onSave || saved || saving) return;
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {!!city && (
          <View style={styles.cityBadge}>
            <Ionicons name="location-outline" size={11} color={colors.primary} />
            <Text style={styles.cityText}>Stores near {city}</Text>
          </View>
        )}
        <Text style={styles.intro}>{outfit.intro}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productRail}
        snapToInterval={productWidth + spacing.md}
        decelerationRate="fast"
      >
        {outfit.items.map((item, idx) => <ProductCard key={`${item.brand}-${item.name}-${idx}`} item={item} width={productWidth} />)}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.budgetLabel}>Est. total</Text>
          <Text style={styles.budgetValue}>{outfit.totalBudget}</Text>
        </View>

        <View style={styles.footerActions}>
          {onRemove && (
            <Pressable style={[styles.footerBtn, styles.footerBtnDestructive]} onPress={onRemove}>
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={[styles.footerBtnText, { color: colors.error }]}>Remove</Text>
            </Pressable>
          )}
          {onSave && (
            <Pressable
              style={[styles.footerBtn, saved && styles.footerBtnSaved]}
              onPress={handleSave}
              disabled={saved || saving}
            >
              <Ionicons
                name={saved ? 'checkmark-outline' : 'bag-handle-outline'}
                size={14}
                color={saved ? '#16A34A' : colors.mutedForeground}
              />
              <Text style={[styles.footerBtnText, saved && styles.footerBtnTextSaved]}>
                {saved ? 'Saved' : saving ? 'Saving…' : saveLabel ?? 'Save'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}24`,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}18`,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  cityText: {
    fontSize: typography.size.xs - 1,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  intro: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
    color: colors.foreground,
    lineHeight: typography.size.xl * 1.35,
  },
  productRail: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  productCard: { height: 430, overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.background },
  productImageWrap: { height: 220, position: 'relative', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  productImage: { width: '100%', height: '100%' },
  productFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  priceBadge: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.full, backgroundColor: 'rgba(250,248,245,0.92)' },
  itemRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryBadge: {
    width: 52,
    flexShrink: 0,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 3,
  },
  categoryLabel: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemInfo: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  itemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  itemName: {
    fontFamily: typography.family.display,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    lineHeight: typography.size.lg * 1.3,
  },
  itemPrice: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  itemBrand: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  itemWhy: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    lineHeight: typography.size.xs * 1.5,
  },
  shopLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 42,
    marginTop: 'auto',
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
  },
  shopLinkText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.primaryForeground,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  budgetLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.mutedForeground,
    fontWeight: typography.weight.semibold,
  },
  budgetValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  footerBtnDestructive: {
    borderColor: `${colors.error}40`,
  },
  footerBtnSaved: {
    borderColor: '#16A34A40',
    backgroundColor: '#F0FDF4',
  },
  footerBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  footerBtnTextSaved: {
    color: '#16A34A',
  },
});
