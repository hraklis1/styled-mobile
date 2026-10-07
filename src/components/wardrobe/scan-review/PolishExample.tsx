import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, radii, spacing, typography } from '../../../theme';
import type { PolishExampleSource } from './usePolishChoice';

/** A piece as photographed and as polished, side by side: the user's own when they have one. */
export function PolishExample({ example }: { example: PolishExampleSource }) {
  return (
    <View style={styles.body}>
      <View style={styles.pair}>
        <Panel uri={example.before} label="Your photo" />
        <Panel uri={example.after} label="Polished" />
      </View>
      <Text style={styles.caption}>
        {`${example.name ? `${example.name}, from your closet. ` : ''}Polish redraws a piece as a clean catalog shot; your original photo is always kept.`}
      </Text>
    </View>
  );
}

function Panel({ uri, label }: { uri: PolishExampleSource['before']; label: string }) {
  return (
    <View style={styles.panel}>
      <View style={styles.frame}>
        <Image source={typeof uri === 'string' ? { uri } : uri} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={label} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  pair: { flexDirection: 'row', gap: spacing.md },
  panel: { flex: 1, gap: spacing.sm, alignItems: 'center' },
  frame: { alignSelf: 'stretch', aspectRatio: 0.8, borderRadius: radii.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  label: { ...typography.text.caption, color: colors.mutedForeground },
  caption: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
