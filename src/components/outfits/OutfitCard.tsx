import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OutfitCollage } from './OutfitCollage';
import { colors, spacing, typography, radii } from '../../theme';
import type { Outfit } from '../../types/outfit';

const COLUMN_COUNT = 2;
const COLUMN_GAP = spacing.md;
const SIDE_PADDING = spacing.lg;

type Props = {
  outfit: Outfit;
  onPress?: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function OutfitCard({
  outfit,
  onPress,
  onLongPress,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PADDING * 2 - COLUMN_GAP) / COLUMN_COUNT;

  const handlePress = selectionMode ? onToggleSelect : onPress;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }, isSelected && styles.cardSelected]}
      onPress={handlePress}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={450}
      activeOpacity={0.85}
    >
      {/* Collage image */}
      <View style={styles.collageWrapper}>
        <OutfitCollage outfit={outfit} size={cardWidth} />

        {/* Selection badge */}
        {selectionMode && (
          <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
            {isSelected && <Ionicons name="checkmark" size={13} color={colors.primaryForeground} />}
          </View>
        )}

        {/* Selected overlay tint */}
        {selectionMode && isSelected && <View style={styles.selectedOverlay} />}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {outfit.name}
        </Text>
        {outfit.event ? (
          <Text style={styles.event} numberOfLines={1}>
            {outfit.event}
          </Text>
        ) : null}
        {outfit.wearCount > 0 ? (
          <Text style={styles.worn}>Worn {outfit.wearCount}×</Text>
        ) : null}
        {outfit.isDraft ? (
          <View style={styles.draftBadge}>
            <Text style={styles.draftText}>Draft</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  cardSelected: {
    opacity: 0.92,
  },
  collageWrapper: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.18)',
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  selectionBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  info: {
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  event: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  worn: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  draftBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  draftText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
});
