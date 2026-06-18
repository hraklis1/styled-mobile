import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ShopOutfitCard } from '../../components/outfits/ShopOutfitCard';
import { useWishlist, useRemoveFromWishlist } from '../../hooks/useWishlist';
import { colors, spacing, typography, radii } from '../../theme';
import type { ShopScreenProps } from '../../navigation/types';

export function ShopScreen(_props: ShopScreenProps) {
  const insets = useSafeAreaInsets();
  const { openStylist } = useGlobalAIStylist();
  const { data: entries = [], isLoading: loading, refetch } = useWishlist();
  const { mutate: removeItem } = useRemoveFromWishlist();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  function handleRemove(id: string) {
    removeItem(id);
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Shop Wishlist</Text>
          <Text style={styles.headerSub}>
            {entries.length === 0 ? 'No saved outfits yet' : `${entries.length} saved outfit${entries.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Ask your AI Stylist to shop for a new outfit. When it suggests one, tap "Save" to add it here.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => openStylist({
              initialQuery: 'Shop for a new outfit for me',
              source: 'shop',
            })}
            activeOpacity={0.85}
            accessibilityLabel="Open AI Stylist"
          >
            <Ionicons name="sparkles" size={15} color={colors.primaryForeground} />
            <Text style={styles.emptyBtnText}>Chat with your Stylist</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.entryWrapper}>
              <View style={styles.entryMetaRow}>
                <Text style={styles.entryDate}>
                  {new Date(item.savedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                {item.eventContext && (
                  <View style={styles.eventChip}>
                    <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                    <Text style={styles.eventChipText} numberOfLines={1}>
                      For {item.eventContext.title}
                    </Text>
                  </View>
                )}
              </View>
              <ShopOutfitCard
                outfit={item.outfit}
                onRemove={() => handleRemove(item.id)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  entryWrapper: {
    gap: spacing.xs,
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  entryDate: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
    paddingLeft: 2,
  },
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '60%',
    backgroundColor: `${colors.primary}15`,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  eventChipText: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    flexShrink: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.sm * 1.6,
    maxWidth: 280,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  emptyBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  emptyPromptChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  emptyPromptText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
});
