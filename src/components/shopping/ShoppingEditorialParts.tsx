import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';

/** The sub-section tier of an editorial chapter: a hairline and a tracked label. */
export function SectionKicker({ title }: { title: string }) {
  return <View style={styles.kicker}><Text accessibilityRole="header" style={styles.kickerText}>{title}</Text></View>;
}

/** Number, eyebrow and serif title that open every chapter on Shop and in the Guide. */
export function ChapterOpener({ index, eyebrow, title, headingRef, trailing }: {
  index: number; eyebrow: string; title: string; headingRef?: Ref<Text>; trailing?: ReactNode;
}) {
  return <View style={styles.opener}>
    <View style={styles.openerMeta}>
      <Text style={styles.numeral} accessibilityElementsHidden importantForAccessibility="no">{String(index).padStart(2, '0')}</Text>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
    </View>
    <View style={styles.titleRow}>
      <Text ref={headingRef} accessibilityRole="header" style={styles.title}>{title}</Text>
      {trailing}
    </View>
  </View>;
}

/** The suggested piece itself, large, before any reasoning about it. */
export function ChapterHero({ target, budget }: { target?: ShoppingPriorityTarget; budget?: string | null }) {
  return <View style={styles.hero}>
    <View style={styles.heroFrame}>{target ? <ShoppingStyleVisual plain fill target={target} /> : <View style={styles.heroSkeleton} />}</View>
    {budget ? <Text style={styles.budget}>Suggested budget · {budget}</Text> : null}
  </View>;
}

/** Explicit hand-off to the next chapter, so the page reads as a sequence. */
export function NextChapterLink({ title, onPress }: { title?: string; onPress: () => void }) {
  const label = title ? `Next: ${title}` : 'Back to top';
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
    <Text style={styles.nextText}>{label} {title ? '↓' : '↑'}</Text>
  </Pressable>;
}

function sentenceCase(note: string) {
  const trimmed = note.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** A ruled spec list: what to check for on the rail or in the store. */
export function SpecList({ notes }: { notes: string[] }) {
  return <View>{notes.map((note, index) => <Text key={index} selectable style={[styles.spec, index > 0 && styles.specRule]}>{sentenceCase(note)}</Text>)}</View>;
}

const styles = StyleSheet.create({
  kicker: { paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  kickerText: { ...typography.text.sectionKicker, color: colors.mutedForeground },
  opener: { gap: spacing.sm },
  openerMeta: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  numeral: { ...typography.text.chapterNumeral, color: shoppingSurfaces.olive.accent },
  eyebrow: { ...typography.text.meta, color: colors.mutedForeground },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.text.editorialChapter, color: colors.foreground, flex: 1 },
  hero: { gap: spacing.sm },
  heroFrame: { width: '62%', alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated },
  heroSkeleton: { aspectRatio: 0.8, backgroundColor: colors.surfaceSubtle },
  budget: { ...typography.text.meta, color: colors.inkSubtle },
  next: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  nextText: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  pressed: { opacity: 0.6 },
  spec: { ...typography.text.body, color: colors.foreground, paddingVertical: spacing.sm },
  specRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
});
