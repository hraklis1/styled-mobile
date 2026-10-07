import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, radii, spacing, typography } from '../../../theme';

/** One of the user's own pieces, as photographed and as polished, side by side. */
export function PolishExample({ example }: { example: { name: string; before: string; after: string } }) {
  return (
    <View style={styles.body}>
      <View style={styles.pair}>
        <Panel uri={example.before} label="Your photo" />
        <Panel uri={example.after} label="Polished" />
      </View>
      <Text style={styles.caption}>
        {`${example.name}, from your closet. Polish redraws a piece as a clean catalog shot; your original photo is always kept.`}
      </Text>
    </View>
  );
}

function Panel({ uri, label }: { uri: string; label: string }) {
  return (
    <View style={styles.panel}>
      <View style={styles.frame}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={label} />
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
