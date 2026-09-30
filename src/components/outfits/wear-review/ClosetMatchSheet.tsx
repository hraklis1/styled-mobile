import { useMemo, useState } from 'react';
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

/** Shared in-sheet browser; selecting here is an explicit committed decision. */
export function ClosetPicker({ detection, items, currentItemId, unavailableIds = [], onPick }: {
  detection?: WearDetection;
  items: Item[];
  currentItemId?: number | null;
  unavailableIds?: number[];
  onPick: (itemId: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>(detection ? 'category' : 'all');
  const category = detection ? normalizeScanCategory(detection.attributes.category) : null;
  const tile = (width - spacing.lg * 2 - spacing.md) / 2;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((it) => (!detection || scope === 'all' || q || it.category === category)
      && (!q || [it.name, it.brand, it.color].some((s) => s?.toLowerCase().includes(q))));
    const ranked = detection?.candidates.map((c) => filtered.find((it) => it.id === c.itemId)).filter((it): it is Item => !!it) ?? [];
    const suggested = [...new Map(ranked.map((it) => [it.id, it])).values()];
    const candidateIds = new Set(suggested.map((it) => it.id));
    const rest = filtered.filter((it) => !candidateIds.has(it.id));
    const result: GridRow[] = [];
    const section = (heading: string, entries: Item[]) => {
      if (!entries.length) return;
      result.push({ key: heading, heading });
      for (let i = 0; i < entries.length; i += 2) result.push({ key: `${heading}-${i}`, items: entries.slice(i, i + 2) });
    };
    section('Suggested matches', suggested);
    section('Your closet', rest);
    return result;
  }, [items, detection, scope, category, query]);
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {detection ? <View style={styles.context}>
      <PieceImage cropUrl={detection.cropUrl} cutoutUrl={detection.cutoutUrl} width={48} height={60} />
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
      ListEmptyComponent={<Text style={styles.meta}>Nothing matches. Try another search{detection ? ' or Everything' : ''}.</Text>}
      renderItem={({ item: row }) => 'heading' in row ? <Text style={styles.heading}>{row.heading}</Text> : <View style={styles.tiles}>
        {row.items.map((item) => {
          const unavailable = unavailableIds.includes(item.id);
          const selected = unavailable || item.id === currentItemId;
          return <Pressable key={item.id} style={{ width: tile }} disabled={unavailable} onPress={() => { selectionFeedback(); onPick(item.id); }} accessibilityRole="button" accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}${unavailable ? ', Already selected' : ''}`} accessibilityState={{ selected, disabled: unavailable }}>
            <View style={[styles.frame, selected && styles.selected]}>
              <PieceImage item={item} width="100%" height={tile * 1.15} />
              {selected ? <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.white} /></View> : null}
            </View>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.meta}>{unavailable ? 'Already selected' : item.brand}</Text>
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
  tiles: { flexDirection: 'row', gap: spacing.md },
  frame: { borderRadius: radii.photo, borderWidth: stroke.fine, borderColor: 'transparent', overflow: 'hidden' },
  selected: { borderColor: colors.foreground },
  check: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.foreground },
  name: { ...typography.text.bodySmall, color: colors.foreground, marginTop: spacing.xs },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
});
