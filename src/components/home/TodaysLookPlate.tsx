import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { SkeletonBlock } from '../primitives/SkeletonLoader';
import { colors, editorial, motion, radii, spacing, stroke, surfaces, typography } from '../../theme';

/** The caption and empty state sit back on the page gutter, like the copy around them. */
const GUTTER = spacing.page;

/**
 * Plate size for Today's Look: the full screen width, at the app's portrait
 * outfit ratio. The photograph runs edge to edge; only the caption beneath it
 * returns to the page gutter.
 */
export function lookPlateSize(screenWidth: number): { width: number; height: number } {
  const width = Math.round(screenWidth);
  return { width, height: Math.round(width / editorial.outfitAspectRatio) };
}

const matLayout = LinearTransition.duration(motion.base).reduceMotion(ReduceMotion.System);

type LookMatProps = {
  /** The photograph or collage, already sized to `lookPlateSize`. */
  plate: ReactNode;
  /**
   * A status kicker ("One piece away"). Only for looks that need one — the
   * section heading already says "Today's Look", so a plain pick has none.
   */
  eyebrow?: string;
  title: string;
  /** The stylist's note on why this look, set as an italic standfirst. */
  note?: string;
  onOpen: () => void;
  /** Label for the plate (and the whole mat when there is no `action`). */
  accessibilityLabel: string;
  /** Label for the caption when it is its own target beside an `action`. */
  captionAccessibilityLabel?: string;
  /** A trailing control (save / find). Without one, the whole mat is the target. */
  action?: ReactNode;
  /**
   * The plate handles its own touches (a swipeable pager). It is laid in
   * place rather than wrapped in the mat's button, so swipes and per-page taps
   * reach it.
   */
  interactivePlate?: boolean;
  /** Collage tiles own their taps; the caption exposes an explicit details link. */
  collageCaption?: boolean;
  /** Home's editorial treatment: introduction above, a single action below. */
  editorialCollage?: boolean;
  largeText?: boolean;
};

/**
 * Today's Look as a full-bleed plate: the photograph runs to the screen's
 * edges with no card chrome, and the caption is docked beneath it on the
 * canvas rather than laid over the image, so type never lands on a hem or a
 * shoe and the flat lay reads whole.
 *
 * The caption is set like a magazine spread's credit: a serif title and one
 * italic line in the stylist's voice. Nothing restates the section heading,
 * and there is no "Open" link — the plate itself is the way in.
 *
 * It bleeds out of the page's gutter itself, so callers place it like any
 * other section content.
 */
export function LookMat({
  plate, eyebrow, title, note, onOpen, accessibilityLabel, captionAccessibilityLabel, action, largeText, interactivePlate, collageCaption, editorialCollage,
}: LookMatProps) {
  const caption = (
    <>
      {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
      <Text style={styles.title} numberOfLines={largeText ? 3 : 2}>{title}</Text>
      {note ? <Text style={styles.note} numberOfLines={largeText ? 4 : 2}>{note}</Text> : null}
    </>
  );

  if (collageCaption) {
    if (editorialCollage) {
      return (
        <Animated.View layout={matLayout} entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} style={styles.mat}>
          {note ? <Text style={[styles.note, styles.collageIntroduction]}>{note}</Text> : null}
          <View style={styles.plate}>{plate}</View>
          {action ? <View style={styles.editorialFooter}>{action}</View> : null}
        </Animated.View>
      );
    }
    return (
      <Animated.View layout={matLayout} entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} style={styles.mat}>
        <View style={styles.plate}>{plate}</View>
        <View style={styles.collageCaption}>
          {!eyebrow ? <Text style={styles.title}>{title}</Text> : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <View style={styles.collageActions}>
            <PressableScale onPress={onOpen} contentStyle={styles.detailsLink} accessibilityRole="button" accessibilityLabel={captionAccessibilityLabel ?? `Look details: ${title}`}>
              <Text style={styles.actionLabel}>Look details</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.foreground} accessible={false} />
            </PressableScale>
            {action}
          </View>
        </View>
      </Animated.View>
    );
  }

  if (!action && !interactivePlate) {
    return (
      <Animated.View layout={matLayout} entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} style={styles.mat}>
        <PressableScale
          scaleTo={0.99}
          motion="crisp"
          haptic={false}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <View style={styles.plate}>{plate}</View>
          <View style={[styles.captionBar, eyebrow && styles.suggestionBar]}>
            <View style={[styles.captionCopy, styles.captionCopyInner]}>{caption}</View>
          </View>
        </PressableScale>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      layout={matLayout}
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(200)}
      style={styles.mat}
    >
      {interactivePlate ? (
        <View style={styles.plate}>{plate}</View>
      ) : (
        <PressableScale
          contentStyle={styles.plate}
          scaleTo={0.99}
          motion="crisp"
          haptic={false}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {plate}
        </PressableScale>
      )}
      <View style={[styles.captionBar, eyebrow && styles.suggestionBar]}>
        <PressableScale
          style={styles.captionCopy}
          contentStyle={styles.captionCopyInner}
          haptic={false}
          scaleTo={0.99}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={captionAccessibilityLabel ?? accessibilityLabel}
        >
          {caption}
        </PressableScale>
        {action}
      </View>
    </Animated.View>
  );
}

type LookMatActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** With a label the action is a small outlined pill; without, a round button. */
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  multiline?: boolean;
  variant?: 'outlined' | 'text';
};

/** A 1pt outlined control for the mat's caption bar. */
export function LookMatAction({ icon, label, onPress, disabled, accessibilityLabel, accessibilityHint, multiline, variant = 'outlined' }: LookMatActionProps) {
  return (
    <PressableScale
      style={multiline ? { maxWidth: '100%' } : undefined}
      contentStyle={[variant === 'text' ? styles.textAction : label ? styles.actionPill : styles.actionRound, multiline && styles.actionMultiline, disabled && styles.actionDisabled]}
      pressedContentStyle={styles.actionPressed}
      motion="crisp"
      scaleTo={0.96}
      hitSlop={label ? 4 : 2}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
    >
      {variant !== 'text' ? <Ionicons name={icon} size={label ? 15 : 17} color={colors.foreground} /> : null}
      {label ? <Text style={styles.actionLabel} numberOfLines={multiline ? undefined : 1}>{label}</Text> : null}
      {variant === 'text' ? <Ionicons name="arrow-forward" size={17} color={colors.foreground} accessible={false} /> : null}
    </PressableScale>
  );
}

/**
 * The mat while the look is still being resolved. Same plate height and a
 * caption skeleton of the same depth, so nothing below moves when it lands.
 */
export function LookMatPreparing({ width, height }: { width: number; height: number }) {
  return (
    <Animated.View
      layout={matLayout}
      exiting={FadeOut.duration(160)}
      style={styles.mat}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Curating today’s look"
    >
      <View style={[styles.plate, { width, height }]}>
        <SkeletonBlock width={width} height={height} borderRadius={0} />
        <View style={styles.preparingOverlay} pointerEvents="none">
          <Text style={styles.preparingText}>Curating today’s look…</Text>
        </View>
      </View>
      <View style={styles.captionSkeleton}>
        <SkeletonBlock width={Math.min(220, width * 0.6)} height={22} borderRadius={2} />
        <SkeletonBlock width={Math.min(280, width * 0.75)} height={14} borderRadius={2} />
        <SkeletonBlock width={Math.min(180, width * 0.5)} height={14} borderRadius={2} />
      </View>
    </Animated.View>
  );
}

type LookMatEmptyProps = {
  width: number;
  height: number;
  title: string;
  subtitle: string;
  /** Primary way forward, e.g. "Add clothes". */
  cta?: { label: string; accessibilityLabel: string; onPress: () => void };
};

/**
 * No look today: the mat stays, holding an empty stitched plate, so the page
 * keeps its frame and the absence reads as intentional rather than broken.
 */
export function LookMatEmpty({ width, height, title, subtitle, cta }: LookMatEmptyProps) {
  return (
    <Animated.View layout={matLayout} entering={FadeIn.duration(260)} style={styles.mat}>
      <View style={[styles.emptyPlate, { width: width - GUTTER * 2, minHeight: height }]}>
        <Ionicons name="layers-outline" size={22} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
        {cta ? (
          <PressableScale
            contentStyle={styles.emptyCta}
            pressedContentStyle={styles.emptyCtaPressed}
            motion="crisp"
            scaleTo={0.97}
            onPress={cta.onPress}
            accessibilityRole="button"
            accessibilityLabel={cta.accessibilityLabel}
          >
            <Ionicons name="add" size={16} color={colors.primaryForeground} />
            <Text style={styles.emptyCtaText}>{cta.label}</Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Bleeds out of the section's page gutter to the screen edges.
  mat: {
    marginHorizontal: -GUTTER,
  },
  plate: {
    overflow: 'hidden',
    backgroundColor: surfaces.plate,
  },
  suggestionBar: { marginHorizontal: GUTTER, paddingHorizontal: 0, marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.lg,
  },
  captionCopy: { flex: 1, minWidth: 0 },
  collageCaption: { paddingHorizontal: GUTTER, paddingTop: spacing.lg, gap: spacing.sm },
  collageIntroduction: { marginHorizontal: GUTTER, marginBottom: spacing.lg },
  editorialFooter: { marginHorizontal: GUTTER, marginTop: spacing.lg, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, alignItems: 'flex-end' },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  collageActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  detailsLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionMultiline: { maxWidth: '100%', paddingVertical: spacing.sm },
  captionCopyInner: { gap: 6 },
  eyebrow: {
    ...typography.text.masthead,
    color: colors.accentInk,
    marginBottom: 2,
  },
  title: {
    ...typography.text.editorialSection,
    color: colors.foreground,
  },
  note: {
    ...typography.text.editorialItalic,
    fontSize: 16,
    lineHeight: 22,
    color: colors.inkSubtle,
  },
  actionRound: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPill: {
    minHeight: 44,
    maxWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
  },
  actionPressed: { backgroundColor: colors.surfaceSubtle },
  actionDisabled: { opacity: 0.45 },
  actionLabel: {
    ...typography.text.meta,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    flexShrink: 1,
  },
  preparingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preparingText: {
    ...typography.text.editorialItalic,
    color: colors.mutedForeground,
  },
  captionSkeleton: {
    gap: 8,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.lg,
    paddingBottom: 6,
  },
  emptyPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderRadius: radii.photo,
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
    marginHorizontal: GUTTER,
  },
  emptyTitle: {
    ...typography.text.editorialCard,
    color: colors.foreground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptySubtitle: {
    ...typography.text.meta,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyCta: {
    minHeight: 44,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
  },
  emptyCtaPressed: { backgroundColor: colors.primarySoftPressed },
  emptyCtaText: { ...typography.text.label, color: colors.primaryForeground },
});
