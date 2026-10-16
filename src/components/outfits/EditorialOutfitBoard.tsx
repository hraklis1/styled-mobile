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

function SuggestionTile({ suggestion, width, onPress, compact }: { suggestion: BoardSuggestion; width: number; onPress?: () => void; compact?: boolean }) {
  const offer = suggestion.offer;
  const [failedUri, setFailedUri] = useState<string>();
  const showOffer = !!offer && failedUri !== offer.imageUrl;
  const art = Math.round(width * (compact ? 0.35 : 0.62));
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

/**
 * Grid-mode stand-in for a piece you don't own: an outline of its shape and a
 * quiet label. No product, price or brand: those live in the look's sheet.
 */
function GhostSlot({ suggestion, width, height, onPress }: { suggestion: BoardSuggestion; width: number; height: number; onPress?: () => void }) {
  const art = Math.round(Math.min(width, height) * 0.38);
  return <Pressable disabled={!onPress} onPress={onPress}
    style={({ pressed }) => [{ width, height }, styles.ghost, pressed && styles.pressed]}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`Missing piece: ${suggestion.label}. Not in your closet`}
    accessibilityHint={onPress ? 'See options for this piece' : undefined}>
    <View style={{ opacity: 0.45 }}><CategorySilhouette category={suggestion.category} size={art} color={colors.inkSubtle} /></View>
    <View style={styles.ghostLabelRow}>
      <Ionicons name="add" size={13} color={colors.inkSubtle} accessible={false} />
      <Text style={styles.ghostLabel} numberOfLines={2}>{suggestion.label}</Text>
    </View>
  </Pressable>;
}

type Props = {
  grid?: boolean;
  pieces: BoardPiece[];
  width: number;
  maxHeight?: number;
  onPressItem?: (id: number) => void;
  suggestion?: BoardSuggestion;
  onPressSuggestion?: () => void;
};

export function EditorialOutfitBoard({ pieces, width: availableWidth, maxHeight, onPressItem, suggestion, onPressSuggestion, grid }: Props) {
  const rows = editorialBoardDisplayRows(pieces, suggestion);
  if (!rows.length) return null;
  if (grid) {
    const height = maxHeight ?? Math.min(320, availableWidth * 1.25);
    const tileWidth = (availableWidth - 24) / 2;
    const tileHeight = (height - 24) / 2;
    // Keep the main outfit categories first; all pieces remain in look details.
    const ordered = [...pieces].sort((a, b) => {
      const order = ['full_body', 'dress', 'top', 'bottom', 'outerwear', 'shoes'];
      const rank = (category: string) => { const index = order.indexOf(category); return index < 0 ? 99 : index; };
      return rank(a.category) - rank(b.category);
    });
    const tiles = ordered.slice(0, suggestion ? 3 : 4);
    return <View style={{ width: availableWidth, height, padding: 8, gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
      {tiles.map(piece => <Pressable key={piece.id} disabled={!onPressItem || !piece.item}
        onPress={() => onPressItem?.(piece.id)} accessibilityRole={onPressItem && piece.item ? 'button' : undefined}
        accessibilityLabel={`View ${piece.item?.name ?? piece.category}`}
        style={({ pressed }) => [{ width: tileWidth, height: tileHeight, backgroundColor: '#F6F3EE', borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, pressed && styles.pressed]}>
        <Photo piece={piece} width={Math.min(tileWidth - 12, tileHeight - 12) / 1.25} foundation />
      </Pressable>)}
      {suggestion ? <GhostSlot suggestion={suggestion} width={tileWidth} height={tileHeight} onPress={onPressSuggestion} /> : null}
      {Array.from({ length: Math.max(0, 4 - tiles.length - (suggestion ? 1 : 0)) }, (_, index) => <View key={`empty-${index}`} accessible={false} style={{ width: tileWidth, height: tileHeight, borderRadius: 8, backgroundColor: '#F6F3EE' }} />)}
    </View>;
  }
  // Account for captions and row gaps before sizing the artwork, never crop rows.
  const heightFactor = rows.reduce((total, row) => {
    const fraction = row.pieces.length === 1 ? (row.foundation ? 0.72 : 0.4) : 1 / row.pieces.length;
    return total + fraction * (row.foundation ? 1.25 : 1);
  }, 0);
  const copyAllowance = rows.reduce((total, row) => total + (row.pieces.some(tile => tile.kind === 'suggestion') ? 100 : 32), 0);
  const width = maxHeight == null ? availableWidth : Math.min(availableWidth, Math.max(88, (maxHeight - copyAllowance - spacing.md * (rows.length - 1)) / heightFactor));
  return <View style={{ width, gap: spacing.md }}>
    {rows.map((row, index) => <View key={index} style={styles.row}>
      {row.pieces.map(tile => {
        const tileWidth = row.foundation && row.pieces.length === 1 ? width * 0.72 : !row.foundation && row.pieces.length === 1 ? width * 0.4 : (width - 8 * (row.pieces.length - 1)) / row.pieces.length;
        if (tile.kind === 'suggestion') return <SuggestionTile key="suggestion" suggestion={tile.suggestion} width={tileWidth} onPress={onPressSuggestion} compact />;
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
  ghost: { borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.stitch, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
  ghostLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  ghostLabel: { ...typography.text.caption, color: colors.inkSubtle, textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
