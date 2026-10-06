import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';

export function useShoppingChapters(identity: string) {
  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const chapters = useRef(new Map<string, View>());
  const headings = useRef(new Map<string, Text | View>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => { if (timer.current) clearTimeout(timer.current); }, [identity]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function jump(key: string) {
    const node = chapters.current.get(key);
    if (!node || !content.current) return;
    node.measureLayout(content.current, (_x, y) => {
      if (chapters.current.get(key) !== node) return;
      scroll.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (chapters.current.get(key) !== node) return;
        const handle = findNodeHandle(headings.current.get(key) ?? node);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }, reduceMotion ? 0 : 350);
    }, () => undefined);
  }
  return { scroll, content, chapters, headings, jump };
}

export function ShoppingChapterContents({ entries, onSelect }: {
  entries: { key: string; title: string; detail?: string }[];
  onSelect: (key: string) => void;
}) {
  return <View style={styles.list}>{entries.map((entry, index) => <Pressable key={entry.key}
    accessibilityRole="button" accessibilityLabel={`${entry.title}${entry.detail ? `. ${entry.detail}` : ''}`}
    accessibilityHint="Jumps to this chapter" onPress={() => onSelect(entry.key)}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
    <View style={styles.copy}><Text style={styles.title}>{entry.title}</Text>{entry.detail ? <Text style={styles.detail}>{entry.detail}</Text> : null}</View>
    <Text style={styles.arrow} accessibilityElementsHidden>↓</Text>
  </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.xs }, row: { minHeight: 44, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: { ...typography.text.priorityNumeral, color: shoppingSurfaces.olive.accent, width: 24 },
  copy: { flex: 1, gap: spacing.xs }, title: { ...typography.text.label, color: colors.foreground },
  detail: { ...typography.text.caption, color: colors.inkSubtle }, arrow: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  pressed: { backgroundColor: colors.surfaceSelected },
});
