import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, surfaces, typography } from '../../theme';
import { boardPhotoUri, editorialBoardRows, type BoardPiece } from './editorialBoardLayout';

function Photo({ piece, width, foundation }: { piece: BoardPiece; width: number; foundation: boolean }) {
  const uri = boardPhotoUri(piece.item);
  const [failedUri, setFailedUri] = useState<string>();
  return <View style={[styles.photo, { width, height: foundation ? width * 1.25 : width }]}>
    {uri && failedUri !== uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" contentPosition="center" cachePolicy="memory-disk" recyclingKey={`${piece.id}:${uri}`} onError={() => setFailedUri(uri)} /> : <Ionicons name="shirt-outline" size={24} color={colors.mutedForeground} />}
  </View>;
}
export function EditorialOutfitBoard({ pieces, width, onPressItem }: { pieces: BoardPiece[]; width: number; onPressItem?: (id: number) => void }) {
  const rows = editorialBoardRows(pieces);
  if (!rows.length) return null;
  return <View style={{ width, gap: spacing.md }}>
    {rows.map((row, index) => <View key={index} style={styles.row}>
      {row.pieces.map(piece => {
        const tileWidth = row.foundation && row.pieces.length === 1 ? width * 0.72 : !row.foundation && row.pieces.length === 1 ? width * 0.4 : (width - 8 * (row.pieces.length - 1)) / row.pieces.length;
        const content = <><Photo piece={piece} width={tileWidth} foundation={row.foundation} /><Text style={styles.caption}>{piece.category === 'full_body' ? 'Dress / one-piece' : piece.category.replaceAll('_', ' ')}</Text></>;
        return onPressItem && piece.item ? <Pressable key={piece.id} style={({ pressed }) => [{ width: tileWidth, minHeight: 44 }, pressed && { opacity: 0.7 }]} onPress={() => onPressItem(piece.id)} accessibilityRole="button" accessibilityLabel={`View ${piece.item.name}, ${piece.category}`} >{content}</Pressable> : <View key={piece.id} style={{ width: tileWidth }}>{content}</View>;
      })}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'flex-start' },
  photo: { backgroundColor: surfaces.outfitMat, borderRadius: 6, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.text.masthead, fontSize: 10, color: colors.mutedForeground, textAlign: 'center', marginTop: 8 },
});
