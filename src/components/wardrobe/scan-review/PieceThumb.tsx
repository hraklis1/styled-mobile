import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../../../theme';

/** The 4:5 plate every piece thumbnail sits on, in both review workspaces. */
export const PIECE_THUMB = { width: 64, height: 80 } as const;

/**
 * A piece's thumbnail: one plate (square-cornered print, card ground) for
 * detected pieces and closet items alike, in the closet scan and the outfit
 * log. An empty plate shows a quiet garment glyph.
 */
export function PieceThumb({ uri, fit = 'cover', width = PIECE_THUMB.width, height = PIECE_THUMB.height, dimmed, recyclingKey, transition, badge }: {
  uri?: string | null;
  fit?: ImageContentFit;
  width?: number | `${number}%`;
  height?: number;
  /** Not selected: the picture recedes. */
  dimmed?: boolean;
  recyclingKey?: string;
  transition?: number;
  /** Overlaid in the corner, e.g. the polishing badge. */
  badge?: ReactNode;
}) {
  return (
    <View style={[styles.plate, { width, height }, dimmed && styles.dimmed]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={fit} transition={transition} cachePolicy="memory-disk" recyclingKey={recyclingKey ?? uri} />
        : <Ionicons name="shirt-outline" size={typeof height === 'number' && height < 48 ? 14 : 24} color={colors.tertiary} />}
      {badge}
    </View>
  );
}

/** A thumbnail that opens the source photo with the piece outlined. */
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
  plate: { borderRadius: radii.photo, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  badge: { position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
});
