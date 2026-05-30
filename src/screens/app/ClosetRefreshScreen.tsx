import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  useClosetRefresh,
  useMarkItemWorn,
  useDeleteItem,
  type ClosetRefreshData,
} from '../../hooks/useItems';
import { colors, spacing, typography, radii } from '../../theme';
import type { ClosetRefreshScreenProps } from '../../navigation/types';
import type { Item } from '../../types/item';

type StaleEntry = ClosetRefreshData['staleItems'][number];
type SimilarGroup = ClosetRefreshData['similarGroups'][number];
type ActiveBucket = 'never_worn' | 'stale' | 'duplicates' | null;

// ─── ItemThumb ───────────────────────────────────────────────────────────────

function ItemThumb({ item, size = 56 }: { item: Item; size?: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: radii.md }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
      ) : (
        <Text style={styles.thumbFallback}>{item.name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  hint,
  onPress,
  testID,
}: {
  label: string;
  value: number;
  hint?: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      testID={testID}
    >
      <View style={styles.statCardInner}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── StaleItemRow ────────────────────────────────────────────────────────────

function StaleItemRow({ entry }: { entry: StaleEntry }) {
  const markWorn = useMarkItemWorn();
  const deleteItem = useDeleteItem();
  const { item, daysSinceWorn, reason } = entry;

  const subtitle =
    reason === 'never_worn'
      ? 'Never tracked as worn'
      : `Last worn ${daysSinceWorn} ${daysSinceWorn === 1 ? 'day' : 'days'} ago`;

  const handleDelete = () => {
    Alert.alert('Remove item', `Remove "${item.name}" from your wardrobe?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteItem.mutate(item.id),
      },
    ]);
  };

  return (
    <View style={styles.staleRow}>
      <ItemThumb item={item} size={52} />
      <View style={styles.staleInfo}>
        <View style={styles.staleNameRow}>
          <Text style={styles.staleItemName} numberOfLines={1}>{item.name}</Text>
          {reason === 'never_worn' && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <Text style={styles.staleCategory} numberOfLines={1}>
          {item.category}{item.color ? ` · ${item.color}` : ''}
        </Text>
        <Text style={styles.staleSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.staleActions}>
        <TouchableOpacity
          style={styles.wornBtn}
          onPress={() => markWorn.mutate(item.id)}
          disabled={markWorn.isPending}
        >
          <Ionicons name="checkmark-circle-outline" size={15} color={colors.primary} />
          <Text style={styles.wornBtnText}>Worn</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          disabled={deleteItem.isPending}
        >
          <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SimilarGroupCard ────────────────────────────────────────────────────────

function SimilarGroupCard({ group }: { group: SimilarGroup }) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={styles.groupHeaderLeft}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <Text style={styles.groupSubtitle}>
            {group.items.length} similar pieces — keep your favourites.
          </Text>
        </View>
        <View style={styles.groupBadge}>
          <Text style={styles.groupBadgeText}>{group.items.length}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groupThumbs}
      >
        {group.items.map((item) => (
          <View key={item.id} style={styles.groupThumbItem}>
            <ItemThumb item={item} size={72} />
            <Text style={styles.groupThumbName} numberOfLines={2}>{item.name}</Text>
            {item.brand ? (
              <Text style={styles.groupThumbBrand} numberOfLines={1}>{item.brand}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── BucketSheetContent ──────────────────────────────────────────────────────

function BucketSheetContent({
  bucket,
  data,
  onClose,
}: {
  bucket: ActiveBucket;
  data: ClosetRefreshData;
  onClose: () => void;
}) {
  const markWorn = useMarkItemWorn();
  const deleteItem = useDeleteItem();

  if (!bucket) return null;

  const title =
    bucket === 'never_worn'
      ? 'Never worn'
      : bucket === 'stale'
      ? `Not worn in ${data.summary.staleThresholdDays}+ days`
      : 'Possible duplicates';

  const items: Item[] =
    bucket === 'never_worn' || bucket === 'stale'
      ? data.staleItems.filter((s) => s.reason === bucket).map((s) => s.item)
      : data.similarGroups.flatMap((g) => g.items);

  const handleDelete = (item: Item) => {
    Alert.alert('Remove item', `Remove "${item.name}" from your wardrobe?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteItem.mutate(item.id),
      },
    ]);
  };

  return (
    <View style={styles.bucketSheet}>
      <View style={styles.bucketSheetHandle} />
      <View style={styles.bucketSheetHeader}>
        <Text style={styles.bucketSheetTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.bucketCloseBtn}>
          <Ionicons name="close" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.bucketList}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={styles.staleRow}>
            <ItemThumb item={item} size={52} />
            <View style={styles.staleInfo}>
              <Text style={styles.staleItemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.staleCategory} numberOfLines={1}>
                {item.category}{item.color ? ` · ${item.color}` : ''}
              </Text>
            </View>
            <View style={styles.staleActions}>
              {bucket !== 'duplicates' && (
                <TouchableOpacity
                  style={styles.wornBtn}
                  onPress={() => markWorn.mutate(item.id)}
                  disabled={markWorn.isPending}
                >
                  <Ionicons name="checkmark-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.wornBtnText}>Worn</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                disabled={deleteItem.isPending}
              >
                <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shirt-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>Nothing here right now — that's a good thing.</Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function ClosetRefreshScreen({ navigation }: ClosetRefreshScreenProps) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useClosetRefresh();
  const [activeBucket, setActiveBucket] = useState<ActiveBucket>(null);

  const showRecommendation =
    data !== undefined &&
    (data.summary.neverWornCount + data.summary.staleCount >= 5 ||
      data.similarGroups.length >= 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Closet Refresh</Text>
          <Text style={styles.headerSubtitle}>A gentle look at what you wear</Text>
        </View>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Analysing your wardrobe…</Text>
        </View>
      )}

      {/* Error */}
      {isError && (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={styles.errorText}>Couldn't load closet insights.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {data && !activeBucket && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Stat cards 2×2 */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                label="Total pieces"
                value={data.summary.totalItems}
                testID="card-stat-total"
              />
              <StatCard
                label="Never worn"
                value={data.summary.neverWornCount}
                hint="Not yet tracked as worn."
                testID="card-stat-never-worn"
                onPress={data.summary.neverWornCount > 0 ? () => setActiveBucket('never_worn') : undefined}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                label={`Not worn ${data.summary.staleThresholdDays}d+`}
                value={data.summary.staleCount}
                testID="card-stat-stale"
                onPress={data.summary.staleCount > 0 ? () => setActiveBucket('stale') : undefined}
              />
              <StatCard
                label="Possible duplicates"
                value={data.summary.duplicateCount}
                hint={`${data.similarGroups.length} groups`}
                testID="card-stat-duplicates"
                onPress={data.similarGroups.length > 0 ? () => setActiveBucket('duplicates') : undefined}
              />
            </View>
          </View>

          {/* Recommendation banner */}
          {showRecommendation && (
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </View>
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>Time for a closet edit?</Text>
                <Text style={styles.bannerBody}>
                  You have {data.summary.neverWornCount + data.summary.staleCount} pieces that
                  haven't been worn lately and {data.similarGroups.length} similar-item{' '}
                  {data.similarGroups.length === 1 ? 'group' : 'groups'}. Try marking favourites
                  and letting go of pieces you're not reaching for.
                </Text>
              </View>
            </View>
          )}

          {/* Stale items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Quietly sitting in your closet</Text>
              </View>
              <Text style={styles.sectionCount}>{data.staleItems.length}</Text>
            </View>
            {data.staleItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="shirt-outline" size={36} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>Everything has been worn recently. Nice rotation.</Text>
              </View>
            ) : (
              <View style={styles.staleList}>
                {data.staleItems.slice(0, 30).map((entry) => (
                  <StaleItemRow key={entry.item.id} entry={entry} />
                ))}
                {data.staleItems.length > 30 && (
                  <TouchableOpacity
                    style={styles.showMoreBtn}
                    onPress={() =>
                      setActiveBucket(
                        data.staleItems.some((s) => s.reason === 'stale') ? 'stale' : 'never_worn'
                      )
                    }
                  >
                    <Text style={styles.showMoreText}>Show all {data.staleItems.length} items</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Similar groups */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Pieces that look alike</Text>
              </View>
              <Text style={styles.sectionCount}>{data.similarGroups.length} groups</Text>
            </View>
            {data.similarGroups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="sparkles-outline" size={36} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No close duplicates. Your wardrobe has nice variety.</Text>
              </View>
            ) : (
              <View style={styles.groupList}>
                {data.similarGroups.map((group) => (
                  <SimilarGroupCard key={group.key} group={group} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Bucket drill-down */}
      {data && activeBucket && (
        <BucketSheetContent
          bucket={activeBucket}
          data={data}
          onClose={() => setActiveBucket(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },

  // Stat cards
  statsGrid: { gap: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCardInner: { flex: 1 },
  statLabel: {
    fontSize: 10,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    marginTop: 2,
    lineHeight: typography.size.xxl * 1.2,
  },
  statHint: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: radii.xl,
    alignItems: 'flex-start',
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerText: { flex: 1, gap: spacing.xs },
  bannerTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  bannerBody: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },

  // Sections
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  sectionCount: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },

  // Stale rows
  staleList: { gap: spacing.sm },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
  staleInfo: { flex: 1, gap: 2 },
  staleNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  staleItemName: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  staleCategory: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  staleSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  staleActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  wornBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wornBtnText: {
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.muted,
    borderRadius: radii.full,
  },
  newBadgeText: {
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  showMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  showMoreText: {
    fontSize: typography.size.sm,
    color: colors.primary,
  },

  // Similar groups
  groupList: { gap: spacing.md },
  groupCard: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  groupHeaderLeft: { flex: 1, gap: 2 },
  groupLabel: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  groupSubtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  groupBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  groupBadgeText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontWeight: typography.weight.semibold,
  },
  groupThumbs: { gap: spacing.md, paddingRight: spacing.sm },
  groupThumbItem: { width: 80, gap: 4 },
  groupThumbName: {
    fontSize: 11,
    color: colors.foreground,
    textAlign: 'center',
  },
  groupThumbBrand: {
    fontSize: 10,
    color: colors.primary,
    textAlign: 'center',
  },

  // Thumb
  thumb: {
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbFallback: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.mutedForeground,
  },

  // Empty states
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl * 1.5,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Bucket sheet
  bucketSheet: { flex: 1, backgroundColor: colors.background },
  bucketSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  bucketSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  bucketSheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  bucketCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
