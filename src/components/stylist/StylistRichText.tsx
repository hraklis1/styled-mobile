import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

// ── Markdown-lite renderer (block-level only, NO AST) ──────────────────────────
// React Native <Text> nesting is finicky with regex replacement, so this stays
// deliberately shallow: split on newlines into block rows (bullet vs paragraph),
// and within a row do a single **bold** split into spans. Nothing deeper.
// Used only for `advice`/audit replies — outfit/shop messages keep plain text.

function renderInline(text: string, keyPrefix: string) {
  // Split on **bold** markers; odd indices are the bolded spans.
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyPrefix}-b${i}`} style={styles.bold}>{part}</Text>
    ) : (
      <Text key={`${keyPrefix}-t${i}`}>{part}</Text>
    ),
  );
}

const BULLET_RE = /^\s*[-•*]\s+(.*)$/;

export function StylistRichText({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return; // collapse blank lines into block spacing
    const bullet = trimmed.match(BULLET_RE);
    if (bullet) {
      blocks.push(
        <View key={`row-${idx}`} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{renderInline(bullet[1], `row-${idx}`)}</Text>
        </View>,
      );
    } else {
      blocks.push(
        <Text key={`p-${idx}`} style={styles.paragraph}>
          {renderInline(trimmed, `p-${idx}`)}
        </Text>,
      );
    }
  });

  return (
    <View style={styles.container}>
      {blocks}
      {streaming ? <Text style={styles.paragraph}>▍</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  paragraph: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * 1.6,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  bulletDot: {
    fontSize: typography.size.md,
    color: colors.primary,
    lineHeight: typography.size.md * 1.6,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * 1.6,
  },
  bold: { fontWeight: typography.weight.bold },
});
