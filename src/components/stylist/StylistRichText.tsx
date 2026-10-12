import { useContext } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { StylistTextSegment } from '../../features/stylist/types';
import { OpenItemContext } from './stylistItemContext';

// ── Markdown-lite renderer (line-based, NO AST) ───────────────────────────────
// React Native <Text> nesting is finicky with regex replacement, so this stays
// deliberately shallow: split on newlines into block rows (section label,
// numbered step, bullet or paragraph), and within a row do one pass over
// **bold**, *italic* / _italic_ and owned-piece mentions. Nothing deeper.
// Shared by assistant prose and structured-response introductions.

// Owned mentions travel through the line parser as private-use placeholders.
const MENTION_OPEN = '';
const MENTION_CLOSE = '';
const INLINE_RE = new RegExp(`(\\*\\*.+?\\*\\*|(?<![\\w*])\\*(?!\\s)[^*]+?\\*(?![\\w*])|(?<!\\w)_(?!\\s)[^_]+?_(?!\\w)|${MENTION_OPEN}\\d+${MENTION_CLOSE})`, 'g');

type Mention = { itemId: number; name: string };

function OwnedMention({ mention, onPress }: { mention: Mention; onPress?: (itemId: number) => void }) {
  // Prefer the in-chat item sheet; the navigating context is only a fallback.
  const navigateToItem = useContext(OpenItemContext);
  const openItem = onPress ?? navigateToItem;
  return (
    <Text
      style={styles.mention}
      onPress={openItem ? () => openItem(mention.itemId) : undefined}
      accessibilityRole={openItem ? 'link' : undefined}
      accessibilityHint={openItem ? 'Opens this piece from your wardrobe' : undefined}
    >
      {mention.name}
    </Text>
  );
}

function renderInline(text: string, keyPrefix: string, mentions: Mention[], lead = false, onMention?: (itemId: number) => void) {
  return text.split(INLINE_RE).filter(part => part !== '').map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <Text key={key} style={lead ? styles.leadEmphasis : styles.bold}>{part.slice(2, -2)}</Text>;
    }
    if (part.length > 2 && ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_')))) {
      return <Text key={key} style={styles.italic}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith(MENTION_OPEN) && part.endsWith(MENTION_CLOSE)) {
      const mention = mentions[Number(part.slice(1, -1))];
      if (mention) return <OwnedMention key={key} mention={mention} onPress={onMention} />;
    }
    return <Text key={key}>{part}</Text>;
  });
}

/** Same joining rule as the server's canonical-name insertion. */
function fromSegments(segments: StylistTextSegment[]): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = segments.reduce((acc, segment) => {
    const visible = 'itemId' in segment ? segment.name : segment.text;
    const part = 'itemId' in segment ? `${MENTION_OPEN}${mentions.push(segment) - 1}${MENTION_CLOSE}` : segment.text;
    return acc + (/\S$/.test(acc) && /^[\p{L}\p{N}]/u.test(visible) ? ' ' : '') + part;
  }, '');
  return { text, mentions };
}

const BULLET_RE = /^\s*[-•*]\s+(.*)$/;
const NUMBERED_RE = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const SECTION_RE = /^\s*#{2,4}\s+(.*)$/;

export function StylistRichText({ text, segments, streaming, onMentionPress }: { text: string; segments?: StylistTextSegment[]; streaming?: boolean; onMentionPress?: (itemId: number) => void }) {
  const source = segments?.length ? fromSegments(segments) : { text, mentions: [] };
  const lines = source.text.split('\n');
  const blocks: React.ReactNode[] = [];
  let hasProse = false;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return; // collapse blank lines into block spacing
    const section = trimmed.match(SECTION_RE);
    const numbered = trimmed.match(NUMBERED_RE);
    const bullet = trimmed.match(BULLET_RE);
    if (section) {
      blocks.push(
        <Text key={`h-${idx}`} accessibilityRole="header" style={styles.section}>
          {section[1].replace(/\*\*/g, '')}
        </Text>,
      );
    } else if (numbered) {
      blocks.push(
        <View key={`n-${idx}`} style={styles.listRow}>
          <Text style={styles.numeral}>{numbered[1]}</Text>
          <Text style={styles.listText}>{renderInline(numbered[2], `n-${idx}`, source.mentions, false, onMentionPress)}</Text>
        </View>,
      );
    } else if (bullet) {
      blocks.push(
        <View key={`row-${idx}`} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{renderInline(bullet[1], `row-${idx}`, source.mentions, false, onMentionPress)}</Text>
        </View>,
      );
    } else {
      const lead = !hasProse;
      hasProse = true;
      blocks.push(
        <Text key={`p-${idx}`} style={lead ? styles.lead : styles.paragraph}>
          {renderInline(trimmed, `p-${idx}`, source.mentions, lead, onMentionPress)}
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

// Conversation uses the body face throughout; editorial type is reserved for titles.
const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  paragraph: {
    ...typography.text.body, color: colors.foreground,
  },
  lead: { ...typography.text.body, color: colors.foreground },
  leadEmphasis: { fontWeight: typography.weight.semibold },
  section: { ...typography.text.eyebrow, color: colors.mutedForeground, marginTop: spacing.xs, marginBottom: -spacing.sm },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  numeral: {
    ...typography.text.body,
    minWidth: 18,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  listText: { ...typography.text.body, flex: 1, color: colors.foreground },
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
  italic: { fontStyle: 'italic' },
  // Pressable without underlines: the warm accent and weight read as a link.
  mention: {
    color: colors.accentInk,
    fontWeight: typography.weight.semibold,
  },
});
