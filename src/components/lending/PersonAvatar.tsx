import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography } from '../../theme';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] ?? '';
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Monogram circle for a lend contact; a ring and check mark when selected. */
export function PersonAvatar({ name, size = 56, selected = false, icon }: {
  name: string;
  size?: number;
  selected?: boolean;
  /** Replaces the monogram, e.g. 'add' for an "Add someone" tile. */
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }, selected && styles.ringSelected]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, icon && styles.circleIcon]}>
        {icon
          ? <Ionicons name={icon} size={size * 0.4} color={colors.foreground} />
          : <Text style={[styles.monogram, { fontSize: size * 0.34, lineHeight: size * 0.42 }]}>{initials(name)}</Text>}
      </View>
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={11} color={colors.primaryForeground} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  ringSelected: { borderColor: colors.primary },
  circle: { backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center' },
  circleIcon: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  monogram: { ...typography.text.editorialTitle, color: colors.foreground },
  check: {
    position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
});
