import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, surfaces, typography } from '../../theme';
import { CategorySilhouette } from './CategorySilhouette';
import { boardPhotoUri, editorialBoardDisplayRows, type BoardPiece, type BoardSuggestion } from './editorialBoardLayout';

function Photo({ piece, width, foundation }: { piece: BoardPiece; width: number; foundation: boolean }) {
  const uri = boardPhotoUri(piece.item);
  const [failedUri, setFailedUri] = useState<string>();
  return <View style={[styles.photo, { width, height: foundation ? width * 1.25 : width }]}>
    {uri && failedUri !== uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" contentPosition="center" cachePolicy="memory-disk" recyclingKey={`${piece.id}:${uri}`} onError={() => setFailedUri(uri)} /> : <Ionicons name="shirt-outline" size={24} color={colors.mutedForeground} />}
  </View>;
}

function SuggestionTile({ suggestion, width, onPress }: { suggestion: BoardSuggestion; width: number; onPress?: () => void }) {
  const offer = suggestion.offer;
  const [failedUri, setFailedUri] = useState<string>();
  const showOffer = !!offer && failedUri !== offer.imageUrl;
  const art = Math.round(width * 0.62);
  const meta = showOffer ? [offer.brand, offer.formattedPrice].filter(Boolean).join(' · ') : '';
  return <Pressable disabled={!onPress} onPress={onPress}
    style={({ pressed }) => [{ width, minHeight: Math.max(44, width) }, styles.suggestion, pressed && styles.pressed]}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`Suggested addition: ${suggestion.label}${meta ? `, ${meta}` : ''}. Not in your closet`}
    accessibilityHint={onPress ? 'Shop for this piece' : undefined}>
    {onPress ? <Ionicons name="arrow-forward" size={14} color={colors.accentInk} style={styles.suggestionArrow} accessible={false} /> : null}
    <Text style={styles.suggestionKicker}>Suggested</Text>
    <View style={{ width: art, height: art, alignItems: 'center', justifyContent: 'center' }}>
      {showOffer
        ? <Image source={{ uri: offer.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" transition={200} onError={() => setFailedUri(offer.imageUrl)} />
        : <CategorySilhouette category={suggestion.category} size={Math.round(art * 0.8)} />}
    </View>
    <Text style={styles.suggestionName}>{suggestion.label}</Text>
    {showOffer && offer.brand ? <Text style={styles.suggestionMeta} numberOfLines={1}>{offer.brand}</Text> : null}
    {showOffer && offer.formattedPrice ? <Text style={styles.suggestionPrice} numberOfLines={1}>{offer.formattedPrice}</Text> : null}
  </Pressable>;
}

type Props = {
  pieces: BoardPiece[];
  width: number;
  onPressItem?: (id: number) => void;
  suggestion?: BoardSuggestion;
  onPressSuggestion?: () => void;
};

export function EditorialOutfitBoard({ pieces, width, onPressItem, suggestion, onPressSuggestion }: Props) {
  const rows = editorialBoardDisplayRows(pieces, suggestion);
  if (!rows.length) return null;
  return <View style={{ width, gap: spacing.md }}>
    {rows.map((row, index) => <View key={index} style={styles.row}>
      {row.pieces.map(tile => {
        const tileWidth = row.foundation && row.pieces.length === 1 ? width * 0.72 : !row.foundation && row.pieces.length === 1 ? width * 0.4 : (width - 8 * (row.pieces.length - 1)) / row.pieces.length;
        if (tile.kind === 'suggestion') return <SuggestionTile key="suggestion" suggestion={tile.suggestion} width={tileWidth} onPress={onPressSuggestion} />;
        const piece = tile.piece;
        const content = <><Photo piece={piece} width={tileWidth} foundation={row.foundation} /><Text style={styles.caption}>{piece.category === 'full_body' ? 'Dress / one-piece' : piece.category.replaceAll('_', ' ')}</Text></>;
        return onPressItem && piece.item ? <Pressable key={piece.id} style={({ pressed }) => [{ width: tileWidth, minHeight: 44 }, pressed && styles.pressed]} onPress={() => onPressItem(piece.id)} accessibilityRole="button" accessibilityLabel={`View ${piece.item.name}, ${piece.category}`} >{content}</Pressable> : <View key={piece.id} style={{ width: tileWidth }}>{content}</View>;
      })}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'flex-start' },
  photo: { backgroundColor: surfaces.outfitMat, borderRadius: 6, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.text.masthead, fontSize: 10, color: colors.mutedForeground, textAlign: 'center', marginTop: 8 },
  suggestion: { backgroundColor: surfaces.outfitMat, borderRadius: 6, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.stitch, padding: spacing.sm, gap: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  suggestionArrow: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  suggestionKicker: { ...typography.text.caption, color: colors.accentInk, textAlign: 'center' },
  suggestionName: { ...typography.text.bodySmall, color: colors.foreground, textAlign: 'center' },
  suggestionMeta: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center' },
  suggestionPrice: { ...typography.text.caption, color: colors.foreground, fontWeight: typography.weight.medium, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
