import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

// ── Markdown-lite renderer (block-level only, NO AST) ──────────────────────────
// React Native <Text> nesting is finicky with regex replacement, so this stays
// deliberately shallow: split on newlines into block rows (bullet vs paragraph),
// and within a row do a single **bold** split into spans. Nothing deeper.
// Shared by assistant prose and structured-response introductions.

function renderInline(text: string, keyPrefix: string, lead = false) {
  // Split on **bold** markers; odd indices are the bolded spans.
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyPrefix}-b${i}`} style={lead ? styles.leadEmphasis : styles.bold}>{part}</Text>
    ) : (
      <Text key={`${keyPrefix}-t${i}`}>{part}</Text>
    ),
  );
}

const BULLET_RE = /^\s*[-•*]\s+(.*)$/;

export function StylistRichText({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let hasProse = false;

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
      const lead = !hasProse;
      hasProse = true;
      blocks.push(
        <Text key={`p-${idx}`} style={lead ? styles.lead : styles.paragraph}>
          {renderInline(trimmed, `p-${idx}`, lead)}
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

// Only the first prose block uses the editorial face. Later prose and lists
// use the body face; emphasis follows the face of its containing block.
const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  paragraph: {
    ...typography.text.body, color: colors.foreground,
  },
  lead: { ...typography.text.stylistLead, color: colors.foreground },
  leadEmphasis: { fontFamily: typography.family.editorialMedium },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  bulletDot: {
    fontSize: typography.text.body.fontSize,
    color: colors.primary,
    lineHeight: typography.text.body.fontSize * 1.6,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.text.body.fontSize,
    color: colors.foreground,
    lineHeight: typography.text.body.fontSize * 1.6,
  },
  bold: {
    fontWeight: typography.weight.semibold,
  },
});
