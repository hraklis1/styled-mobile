import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOutfits, useDeleteOutfit, useMarkOutfitWorn } from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { OutfitVisualizationCard } from '../../components/outfits/OutfitVisualizationCard';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS } from '../../types/item';
import type { OutfitDetailScreenProps } from '../../navigation/types';
import { useMemo } from 'react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function Chip({ label }: { label: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
});

export function OutfitDetailScreen({ route, navigation }: OutfitDetailScreenProps) {
  const { outfitId } = route.params;
  const { data: outfits = [] } = useOutfits();
  const { data: items = [] } = useItems();
  const outfit = outfits.find((o) => o.id === outfitId);

  const deleteOutfit = useDeleteOutfit();
  const markWorn = useMarkOutfitWorn();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const pieces = useMemo(() => {
    if (!outfit) return [];
    return [
      outfit.topId,
      outfit.bottomId,
      outfit.shoesId,
      outfit.outerwearId,
      outfit.accessoryId,
    ]
      .filter((id): id is number => id !== null)
      .map((id) => itemMap.get(id))
      .filter(Boolean);
  }, [outfit, itemMap]);

  if (!outfit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isBusy = deleteOutfit.isPending || markWorn.isPending;

  const handleMarkWorn = () => markWorn.mutate(outfit.id);

  const handleDelete = () => {
    Alert.alert(
      'Delete outfit',
      `Delete "${outfit.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteOutfit.mutate(outfit.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Collage / AI image header */}
        <View style={{ position: 'relative' }}>
          <OutfitCollage outfit={outfit} size={width} borderRadius={0} />
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{outfit.name}</Text>
          {outfit.event ? (
            <View style={styles.eventRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.event}>{outfit.event}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, markWorn.isPending && styles.actionDisabled]}
            onPress={handleMarkWorn}
            disabled={isBusy}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Worn today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDelete}
            disabled={isBusy}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.actionLabel, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* AI Visualization */}
        <OutfitVisualizationCard outfit={outfit} />

        {/* Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Times worn</Text>
              <Text style={styles.detailValue}>{outfit.wearCount}</Text>
            </View>
            {outfit.lastWornAt && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Last worn</Text>
                <Text style={styles.detailValue}>{formatDate(outfit.lastWornAt)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pieces */}
        {pieces.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pieces ({pieces.length})</Text>
            <View style={styles.piecesGrid}>
              {pieces.map((item) => {
                if (!item) return null;
                const uri = resolveImageUri(item.imageUrl);
                return (
                  <View key={item.id} style={styles.pieceItem}>
                    <View style={styles.pieceImageContainer}>
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={styles.pieceImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.pieceImage, styles.piecePlaceholder]}>
                          <Ionicons name="shirt-outline" size={20} color={colors.border} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.pieceName} numberOfLines={1}>{item.name}</Text>
                    {item.category ? (
                      <Text style={styles.pieceCategory} numberOfLines={1}>
                        {CATEGORY_LABELS[item.category]}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Tags */}
        {outfit.tags?.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.chipRow}>
              {outfit.tags.map((tag) => <Chip key={tag} label={tag} />)}
            </View>
          </View>
        )}

        {/* Notes */}
        {outfit.notes ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{outfit.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const PIECE_SIZE = 80;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },

  backButton: {
    position: 'absolute',
    left: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  name: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  event: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },

  actionRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },

  detailGrid: { gap: spacing.sm },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  detailValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  piecesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pieceItem: {
    width: PIECE_SIZE,
    alignItems: 'center',
  },
  pieceImageContainer: {
    width: PIECE_SIZE,
    height: PIECE_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    backgroundColor: colors.muted,
  },
  pieceImage: {
    width: '100%',
    height: '100%',
  },
  piecePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  pieceName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  pieceCategory: {
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  notes: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
});
