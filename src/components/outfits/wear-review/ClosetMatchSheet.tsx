import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { TextLink, TextSegment } from '../../wardrobe/scan-review/atoms';
import { selectionFeedback } from '../../wardrobe/scan-review/feedback';
import { itemImageContentFit, itemImageUri } from '../../../lib/itemImage';
import { normalizeScanCategory } from '../../../lib/outfit-log-scan';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { CATEGORY_LABELS, type Item } from '../../../types/item';
import type { WearDetection } from '../../../features/wear-log/types';

const COLS = 3;
const GAP = spacing.sm;

type Scope = 'category' | 'all';

/**
 * "Find in closet": the whole wardrobe, narrowed to the detected category by
 * default, with the scan's own candidates first. One tap decides the row and
 * closes the sheet; Done closes it without changing anything.
 */
export function ClosetMatchSheet({ detection, items, currentItemId, reduceMotion, onPick, onAddNew, onClose }: {
  detection: WearDetection;
  items: Item[];
  currentItemId: number | null;
  reduceMotion: boolean;
  onPick: (itemId: number) => void;
  /** Runs after this sheet has finished closing, so the next one can present. */
  onAddNew: () => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('category');
  const [dismissed, setDismissed] = useState(false);
  const [addNewAfterClose, setAddNewAfterClose] = useState(false);
  const category = normalizeScanCategory(detection.attributes.category);
  const tile = (width - spacing.lg * 2 - GAP * (COLS - 1)) / COLS;

  const list = useMemo(() => {
    const rank = new Map(detection.candidates.map((c, i) => [c.itemId, i]));
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => scope === 'all' || q || it.category === category)
      .filter((it) => !q
        || it.name.toLowerCase().includes(q)
        || it.brand?.toLowerCase().includes(q)
        || it.color?.toLowerCase().includes(q))
      .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }, [category, detection.candidates, items, query, scope]);

  const candidateIds = new Set(detection.candidates.map((c) => c.itemId));

  const pick = (itemId: number) => {
    selectionFeedback();
    onPick(itemId);
    setDismissed(true);
  };

  return (
    <WorkspaceSheet
      title="Find in your closet"
      subtitle={<Text style={styles.subtitle}>For the {detection.attributes.name.toLowerCase()}</Text>}
      detent="large"
      reduceMotion={reduceMotion}
      dismissed={dismissed}
      onClose={addNewAfterClose ? onAddNew : onClose}
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Not in your closet?</Text>
          <TextLink label="Add it as new" onPress={() => { setAddNewAfterClose(true); setDismissed(true); }} />
        </View>
      }
    >
      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, brand or colour"
          placeholderTextColor={colors.tertiary}
          style={styles.search}
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search your closet"
        />
        <TextSegment
          options={[
            { value: 'category', label: CATEGORY_LABELS[category] ?? 'This category' },
            { value: 'all', label: 'Everything' },
          ]}
          value={scope}
          onChange={setScope}
          accessibilityLabel="Which pieces to show"
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(it) => String(it.id)}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>Nothing matches. Try Everything, or add it as a new piece.</Text>}
        renderItem={({ item }) => {
          const selected = item.id === currentItemId;
          return (
            <Pressable
              onPress={() => pick(item.id)}
              style={{ width: tile }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}`}
            >
              <View style={[styles.plate, { height: tile * 1.3 }, selected && styles.plateSelected]}>
                <Image
                  source={{ uri: itemImageUri(item) }}
                  style={StyleSheet.absoluteFill}
                  contentFit={itemImageContentFit(item)}
                  cachePolicy="memory-disk"
                  recyclingKey={String(item.id)}
                />
              </View>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {candidateIds.has(item.id) ? <Text style={styles.hint}>Close match</Text> : null}
            </Pressable>
          );
        }}
      />
    </WorkspaceSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.text.meta, color: colors.mutedForeground },
  controls: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  search: {
    ...typography.text.body,
    color: colors.foreground,
    minHeight: 44,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },
  grid: { padding: spacing.lg, gap: spacing.lg },
  plate: { borderRadius: radii.photo, overflow: 'hidden', backgroundColor: colors.card },
  plateSelected: { borderWidth: stroke.fine, borderColor: colors.foreground },
  name: { ...typography.text.meta, color: colors.foreground, marginTop: spacing.xs },
  hint: { ...typography.text.meta, fontSize: 11, color: colors.accentInk },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  footerText: { ...typography.text.meta, color: colors.mutedForeground },
  empty: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', paddingTop: spacing.xl },
});
