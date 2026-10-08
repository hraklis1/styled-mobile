import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { colors, radii, spacing, typography } from '../../theme';

import type { ScrubberEntry } from '../../lib/closet-scrubber';

/** Right-edge index: touch or drag to jump; a bubble names the current entry. */
export function ListScrubber({ entries, onJump }: {
  entries: ScrubberEntry[];
  onJump: (index: number) => void;
}) {
  const height = useRef(0);
  const last = useRef<number | null>(null);
  const [active, setActive] = useState<ScrubberEntry | null>(null);

  const track = (event: GestureResponderEvent) => {
    if (!height.current || entries.length === 0) return;
    const position = Math.max(0, Math.min(height.current - 1, event.nativeEvent.locationY));
    const slot = Math.floor((position / height.current) * entries.length);
    if (slot === last.current) return;
    last.current = slot;
    setActive(entries[slot]);
    void Haptics.selectionAsync();
    onJump(entries[slot].index);
  };
  const release = () => { last.current = null; setActive(null); };

  if (entries.length < 2) return null;
  return (
    <View style={styles.root} pointerEvents="box-none">
      {active && (
        <View style={styles.bubble} pointerEvents="none">
          <Text style={styles.bubbleText} numberOfLines={1}>{active.title}</Text>
        </View>
      )}
      <View
        style={styles.rail}
        onLayout={(event: LayoutChangeEvent) => { height.current = event.nativeEvent.layout.height; }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={track}
        onResponderMove={track}
        onResponderRelease={release}
        onResponderTerminate={release}
        accessibilityRole="adjustable"
        accessibilityLabel="Jump to section"
        accessibilityValue={active ? { text: active.title } : undefined}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          const current = entries.findIndex(entry => entry.title === active?.title);
          const next = Math.max(0, Math.min(entries.length - 1, current + (nativeEvent.actionName === 'increment' ? 1 : -1)));
          setActive(entries[next]);
          onJump(entries[next].index);
        }}
      >
        {entries.map(entry => (
          <Text
            key={entry.title}
            style={[styles.label, active?.title === entry.title && styles.labelActive]}
            numberOfLines={1}
          >
            {entry.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
  },
  rail: {
    paddingVertical: spacing.sm, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    ...typography.text.eyebrow, fontSize: 10, lineHeight: 15, letterSpacing: 0.4,
    color: colors.mutedForeground,
  },
  labelActive: { color: colors.foreground },
  bubble: {
    minWidth: 56, maxWidth: 180, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginRight: spacing.sm, borderRadius: radii.md, backgroundColor: colors.foreground,
    alignItems: 'center',
  },
  bubbleText: { ...typography.text.cardTitle, color: colors.background },
});
