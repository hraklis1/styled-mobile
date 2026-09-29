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
  eyebrow: string;
  title: string;
  reason?: string;
  onOpen: () => void;
  /** Label for the plate (and the whole mat when there is no `action`). */
  accessibilityLabel: string;
  /** Label for the caption when it is its own target beside an `action`. */
  captionAccessibilityLabel?: string;
  /** A trailing control (save / find). Without one, the mat shows "Open". */
  action?: ReactNode;
  largeText?: boolean;
};

/**
 * Today's Look as a full-bleed plate: the photograph runs to the screen's
 * edges with no card chrome, and the caption is docked beneath it on the
 * canvas rather than laid over the image, so type never lands on a hem or a
 * shoe and the flat lay reads whole.
 *
 * It bleeds out of the page's gutter itself, so callers place it like any
 * other section content.
 */
export function LookMat({
  plate, eyebrow, title, reason, onOpen, accessibilityLabel, captionAccessibilityLabel, action, largeText,
}: LookMatProps) {
  const caption = (
    <>
      <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
      <Text style={styles.title} numberOfLines={largeText ? 2 : 1}>{title}</Text>
      {reason ? <Text style={styles.reason} numberOfLines={largeText ? 2 : 1}>{reason}</Text> : null}
    </>
  );

  if (!action) {
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
          <View style={styles.captionBar}>
            <View style={styles.captionCopy}>{caption}</View>
            <View style={styles.openLink}>
              <Text style={styles.openLinkText}>Open</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
            </View>
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
      <View style={styles.captionBar}>
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
};

/** A 1pt outlined control for the mat's caption bar. */
export function LookMatAction({ icon, label, onPress, disabled, accessibilityLabel, accessibilityHint }: LookMatActionProps) {
  return (
    <PressableScale
      contentStyle={[label ? styles.actionPill : styles.actionRound, disabled && styles.actionDisabled]}
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
      <Ionicons name={icon} size={label ? 15 : 17} color={colors.foreground} />
      {label ? <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text> : null}
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
        <SkeletonBlock width={96} height={10} borderRadius={2} />
        <SkeletonBlock width={Math.min(200, width * 0.6)} height={22} borderRadius={2} />
        <SkeletonBlock width={Math.min(150, width * 0.45)} height={12} borderRadius={2} />
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

/**
 * The stylist's reasoning, set as a pull-quote under the mat. The walnut
 * rule is one of the page's few warm notes, so it stays a single hairline.
 */
export function WhyThisLook({ explanation }: { explanation: string }) {
  return (
    <View style={styles.why} accessible accessibilityLabel={`Why this look: ${explanation}`}>
      <Text style={styles.whyText} numberOfLines={3}>
        <Text style={styles.whyLabel}>Why this look · </Text>
        {explanation}
      </Text>
    </View>
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
  captionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: GUTTER,
    paddingTop: 14,
  },
  captionCopy: { flex: 1, minWidth: 0 },
  captionCopyInner: { gap: 2 },
  eyebrow: {
    ...typography.text.masthead,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  title: {
    ...typography.text.editorialSection,
    color: colors.foreground,
  },
  reason: {
    ...typography.text.meta,
    color: colors.inkSubtle,
  },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openLinkText: {
    ...typography.text.meta,
    color: colors.mutedForeground,
  },
  actionRound: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPill: {
    minHeight: 36,
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
    gap: 6,
    paddingHorizontal: GUTTER,
    paddingTop: 14,
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
  why: {
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    borderLeftWidth: stroke.fine,
    borderLeftColor: colors.accentInk,
  },
  whyLabel: {
    fontFamily: typography.family.editorialMedium,
    color: colors.accentInk,
  },
  whyText: {
    fontFamily: typography.family.editorialRegular,
    fontSize: typography.text.body.fontSize,
    lineHeight: typography.text.body.lineHeight,
    color: colors.inkSubtle,
  },
});
