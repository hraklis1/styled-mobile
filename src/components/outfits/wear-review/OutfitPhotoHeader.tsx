import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../../theme';
import { reviewPhotoHeight } from '../../wardrobe/scan-review/MarkedPhoto';

type Size = { width: number; height: number };

/**
 * The photo's own shape at this width, capped at the closet scan's review
 * photo height so the first rows still show; a tap opens the whole photo.
 */
export function photoHeaderHeight(width: number, screenHeight: number, natural: Size | null) {
  const aspect = natural && natural.width && natural.height ? natural.height / natural.width : 5 / 4;
  return Math.round(Math.min(width * aspect, reviewPhotoHeight(screenHeight)));
}

/**
 * The whole outfit photo at the top of the review list. It scrolls away with
 * the list rather than pinning.
 */
export function OutfitPhotoHeader({ uri, width, height, onNatural, onPress, disabled }: {
  uri: string;
  width: number;
  height: number;
  onNatural: (size: Size) => void;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.frame, { width, height }]} accessibilityRole="imagebutton" accessibilityLabel="View outfit photo and detected pieces">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoad={(e) => onNatural({ width: e.source.width, height: e.source.height })}
        accessibilityIgnoresInvertColors
      />
      <View pointerEvents="none" style={styles.fade}>
        <LinearGradient colors={['rgba(246,245,242,0)', colors.background]} style={StyleSheet.absoluteFill} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceSubtle, overflow: 'hidden' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 },
});
