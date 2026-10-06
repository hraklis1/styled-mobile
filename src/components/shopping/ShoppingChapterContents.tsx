import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';

export function useShoppingChapters(identity: string) {
  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const chapters = useRef(new Map<string, View>());
  const headings = useRef(new Map<string, Text | View>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => { if (timer.current) clearTimeout(timer.current); }, [identity]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  /**
   * `offset` keeps the chapter clear of anything overlaid on the scroll view's
   * top edge. `knownY` skips measuring when the caller already tracks layout.
   */
  function jump(key: string, offset = 0, knownY?: number) {
    const node = chapters.current.get(key);
    if (!node || !content.current) return;
    const land = (y: number) => {
      if (chapters.current.get(key) !== node) return;
      scroll.current?.scrollTo({ y: Math.max(0, y - offset), animated: !reduceMotion });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (chapters.current.get(key) !== node) return;
        const handle = findNodeHandle(headings.current.get(key) ?? node);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }, reduceMotion ? 0 : 350);
    };
    if (knownY != null) land(knownY);
    else node.measureLayout(content.current, (_x, y) => land(y), () => undefined);
  }
  return { scroll, content, chapters, headings, jump };
}

export function ShoppingChapterContents({ entries, onSelect }: {
  entries: { key: string; title: string; detail?: string; target?: ShoppingPriorityTarget; onDismiss?: () => void }[];
  onSelect: (key: string) => void;
}) {
  // Once any row has a picture, every row keeps the same picture column.
  const visual = entries.some(entry => entry.target);
  return <View style={styles.list}>{entries.map((entry, index) => <View key={entry.key} style={styles.entry}>
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${entry.title}${entry.detail ? `. ${entry.detail}` : ''}`}
      accessibilityHint="Opens the full guide" onPress={() => onSelect(entry.key)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {entry.target ? <View style={styles.thumb}><ShoppingStyleVisual plain target={entry.target} /></View>
        : visual ? <View style={[styles.thumb, styles.placeholder]}><Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text></View>
        : <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>}
      <View style={styles.copy}><Text style={styles.title}>{entry.title}</Text>{entry.detail ? <Text style={styles.detail}>{entry.detail}</Text> : null}</View>
      <Text style={styles.arrow} accessibilityElementsHidden>→</Text>
    </Pressable>
    {entry.onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel={`Not now: ${entry.title}`} onPress={entry.onDismiss}
      style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}><Text style={styles.detail}>Not now</Text></Pressable> : null}
  </View>)}</View>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.xs }, entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dismiss: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  row: { flex: 1, minHeight: 44, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 48 },
  placeholder: { aspectRatio: 0.8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  number: { ...typography.text.priorityNumeral, color: shoppingSurfaces.olive.accent, width: 24 },
  copy: { flex: 1, gap: spacing.xs }, title: { ...typography.text.label, color: colors.foreground },
  detail: { ...typography.text.caption, color: colors.inkSubtle }, arrow: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  pressed: { backgroundColor: colors.surfaceSelected },
});
