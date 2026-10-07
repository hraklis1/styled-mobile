import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { itemImageContentFit, itemImageUri } from '../../../lib/itemImage';
import { colors, radii } from '../../../theme';
import type { Item } from '../../../types/item';

/**
 * Shared fitting for wardrobe photos and detected pieces. A detection shows
 * its background-intact crop, filling the tile; the cutout is the fallback.
 */
export function PieceImage({ item, cropUrl, cutoutUrl, width = 64, height = 80 }: {
  item?: Item; cropUrl?: string | null; cutoutUrl?: string | null; width?: number | `${number}%`; height?: number;
}) {
  const uri = item ? itemImageUri(item) : cropUrl ?? cutoutUrl;
  const fit = item ? itemImageContentFit(item) : cropUrl ? 'cover' : 'contain';
  return (
    <View style={[styles.plate, { width, height }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={fit} cachePolicy="memory-disk" recyclingKey={item ? String(item.id) : uri} />
        : <Ionicons name="shirt-outline" size={24} color={colors.tertiary} />}
    </View>
  );
}

/** A detected piece's thumbnail that opens the outfit photo with the piece outlined. */
export function LocateInPhoto({ name, onPress, children }: { name: string; onPress?: () => void; children: ReactNode }) {
  if (!onPress) return <>{children}</>;
  return (
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button" accessibilityLabel={`Show ${name} in your photo`}>
      {children}
      <View style={styles.badge}><Ionicons name="scan-outline" size={12} color={colors.foreground} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  badge: { position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  plate: { borderRadius: radii.photo, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
