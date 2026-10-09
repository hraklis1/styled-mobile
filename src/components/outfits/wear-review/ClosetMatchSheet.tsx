import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextSegment } from '../../wardrobe/scan-review/atoms';
import { selectionFeedback } from '../../wardrobe/scan-review/feedback';
import { normalizeScanCategory } from '../../../lib/outfit-log-scan';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { CATEGORY_LABELS, type Item } from '../../../types/item';
import type { WearDetection } from '../../../features/wear-log/types';
import { PieceImage } from './PieceImage';

type Scope = 'category' | 'all';
type GridRow = { key: string; heading: string } | { key: string; items: Item[] };

/**
 * The closet browser for the outfit log: matching one detected piece (a
 * pick is a committed decision), or, with `selectedIds`, choosing the pieces
 * worn by hand, where a pick toggles.
 */
export function ClosetPicker({ detection, items, currentItemId, selectedIds, unavailableIds = [], columns = 2, footer, emptyHint, onPick }: {
  detection?: WearDetection;
  items: Item[];
  currentItemId?: number | null;
  /** Multi-select: every selected piece is checked, and a pick toggles it. */
  selectedIds?: number[];
  unavailableIds?: number[];
  columns?: number;
  footer?: ReactNode;
  /** Shown under the empty state when the closet itself is empty. */
  emptyHint?: string;
  onPick: (itemId: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>(detection ? 'category' : 'all');
  const category = detection ? normalizeScanCategory(detection.attributes.category) : null;
  const gap = columns > 2 ? spacing.sm : spacing.md;
  const tile = (width - spacing.lg * 2 - gap * (columns - 1)) / columns;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((it) => (!detection || scope === 'all' || q || it.category === category)
      && (!q || [it.name, it.brand, it.color, it.category].some((s) => s?.toLowerCase().includes(q))));
    const ranked = detection?.candidates.map((c) => filtered.find((it) => it.id === c.itemId)).filter((it): it is Item => !!it) ?? [];
    const suggested = [...new Map(ranked.map((it) => [it.id, it])).values()];
    const candidateIds = new Set(suggested.map((it) => it.id));
    const rest = filtered.filter((it) => !candidateIds.has(it.id));
    const result: GridRow[] = [];
    const section = (heading: string, entries: Item[]) => {
      if (!entries.length) return;
      result.push({ key: heading, heading });
      for (let i = 0; i < entries.length; i += columns) result.push({ key: `${heading}-${i}`, items: entries.slice(i, i + columns) });
    };
    section('Suggested matches', suggested);
    // Choosing by hand there is nothing to suggest, so no heading either.
    if (detection) section('Your closet', rest);
    else for (let i = 0; i < rest.length; i += columns) result.push({ key: `all-${i}`, items: rest.slice(i, i + columns) });
    return result;
  }, [items, detection, scope, category, query, columns]);
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {detection ? <View style={styles.context}>
      <PieceImage cropUrl={detection.cropUrl} width={48} height={60} />
      <View style={styles.copy}><Text style={styles.name}>{detection.attributes.name}</Text><Text style={styles.meta}>Detected from your photo</Text></View>
    </View> : null}
    <View style={styles.controls}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.mutedForeground} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search your closet" placeholderTextColor={colors.tertiary} style={styles.input} autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel="Search name, brand or colour" />
      </View>
      {detection ? <TextSegment<Scope> options={[{ value: 'category', label: category ? CATEGORY_LABELS[category] ?? 'This category' : 'This category' }, { value: 'all', label: 'Everything' }]} value={scope} onChange={setScope} accessibilityLabel="Which pieces to show" /> : null}
    </View>
    <FlatList data={rows} keyExtractor={(row) => row.key} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.grid}
      ListEmptyComponent={items.length === 0 ? <View style={styles.empty}>
        <Text style={styles.heading}>No pieces yet</Text>
        {emptyHint ? <Text style={styles.meta}>{emptyHint}</Text> : null}
      </View> : <Text style={styles.meta}>Nothing matches. Try another search{detection ? ' or Everything' : ''}.</Text>}
      ListFooterComponent={footer ? <View style={styles.footer}>{footer}</View> : null}
      renderItem={({ item: row }) => 'heading' in row ? <Text style={styles.heading}>{row.heading}</Text> : <View style={[styles.tiles, { gap }]}>
        {row.items.map((item) => {
          const unavailable = unavailableIds.includes(item.id);
          const selected = unavailable || (selectedIds ? selectedIds.includes(item.id) : item.id === currentItemId);
          return <Pressable key={item.id} style={{ width: tile }} disabled={unavailable} onPress={() => { selectionFeedback(); onPick(item.id); }} accessibilityRole="button" accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}${unavailable ? ', Already selected' : ''}`} accessibilityState={{ selected, disabled: unavailable }}>
            <View style={[styles.frame, selected && styles.selected]}>
              <PieceImage item={item} width="100%" height={tile * 1.25} />
              {selected ? <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.white} /></View> : null}
            </View>
            <Text style={styles.name} numberOfLines={columns > 2 ? 1 : 2}>{item.name}</Text>
            {columns > 2 && !unavailable ? null : <Text style={styles.meta} numberOfLines={1}>{unavailable ? 'Already selected' : item.brand}</Text>}
          </Pressable>;
        })}
      </View>} />
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSubtle, borderRadius: radii.md, paddingHorizontal: spacing.md },
  input: { ...typography.text.bodySmall, color: colors.foreground, minHeight: 48, flex: 1 },
  context: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: 4 },
  grid: { padding: spacing.lg, gap: spacing.md },
  heading: { ...typography.text.editorialSection, color: colors.foreground },
  tiles: { flexDirection: 'row' },
  empty: { gap: spacing.xs, paddingTop: spacing.lg },
  footer: { paddingTop: spacing.md, alignItems: 'center' },
  frame: { borderRadius: radii.photo, borderWidth: stroke.fine, borderColor: 'transparent', overflow: 'hidden' },
  selected: { borderColor: colors.foreground },
  check: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.foreground },
  name: { ...typography.text.bodySmall, color: colors.foreground, marginTop: spacing.xs },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
});
