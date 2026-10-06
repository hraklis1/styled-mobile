import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import Svg, { Circle, Path } from 'react-native-svg';
import { colors, radii, spacing, typography } from '../../theme';
import { PressableScale } from './PressableScale';

const CARET_SIZE = 10;

type Props = {
  visible: boolean;
  title: string;
  body: string;
  onDismiss: () => void;
  /** Positions the callout itself — typically `top`/`right` near the anchor button. */
  style?: StyleProp<ViewStyle>;
  /** Horizontal offset of the caret from the callout's right edge, lined up with the button it points at. */
  caretRight?: number;
  /** Offset of the caret from the callout's left edge, for anchors on the left. Wins over `caretRight`. */
  caretLeft?: number;
  /** Spoken when the scrim behind the callout is tapped to dismiss it. */
  scrimAccessibilityLabel?: string;
  /** Multi-step tours: 0-based index of this step and the total, shown as dots. */
  step?: number;
  stepCount?: number;
  /** Replaces "Got it" — e.g. "Next" mid-tour. */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** Shows a "Skip" link beside the primary action. */
  onSkip?: () => void;
  /** Window rect of the control being explained; it stays lit through the scrim. */
  spotlight?: { x: number; y: number; width: number; height: number };
  /** 'bottom' points the caret down, for a callout sitting above its anchor. */
  caretPlacement?: 'top' | 'bottom';
  /** 'light' draws a pale card, for dark surfaces such as the camera. */
  tone?: 'dark' | 'light';
  /** 'fit' hugs the target's own shape (pill or circle) instead of circling it. */
  spotlightShape?: 'circle' | 'fit';
};

/**
 * A one-time callout pointed at the control it explains. It carries its own
 * dimming layer: the page behind it greys out so the tip is the only lit thing
 * on screen, and tapping anywhere on that layer dismisses it.
 *
 * The scrim lives in a transparent modal rather than a view in the host screen,
 * because the tab bar belongs to the navigator above every screen — a view
 * inside one can't cover it. Positioning via `style` is therefore in
 * screen coordinates, which is what every caller's inset-based offsets already
 * assume.
 */
export function AiActionCoachmark({
  visible,
  title,
  body,
  onDismiss,
  style,
  caretRight = 22,
  caretLeft,
  scrimAccessibilityLabel = 'Dismiss this tip',
  step,
  stepCount,
  primaryLabel = 'Got it',
  onPrimary,
  onSkip,
  spotlight,
  caretPlacement = 'top',
  tone = 'dark',
  spotlightShape = 'circle',
}: Props) {
  const light = tone === 'light';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translateY.setValue(-6);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, step, opacity, translateY]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={scrimAccessibilityLabel}
        onPress={onDismiss}
        style={[styles.scrim, spotlight && styles.scrimClear]}
      >
        {spotlight ? <Spotlight rect={spotlight} shape={spotlightShape} /> : null}
        <Animated.View
          style={[styles.container, style, { opacity, transform: [{ translateY }] }]}
          pointerEvents="box-none"
        >
          <View style={[
            styles.caret,
            caretPlacement === 'bottom' && styles.caretBottom,
            light && styles.caretLight,
            caretLeft !== undefined ? { left: caretLeft } : { right: caretRight },
          ]} />
          {/* Claims touches so a tap on the copy doesn't fall through to the dismissing scrim. */}
          <View style={[styles.card, light && styles.cardLight]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.title, light && styles.titleLight]}>{title}</Text>
            <Text style={[styles.body, light && styles.bodyLight]}>{body}</Text>
            <View style={[styles.footer, !(stepCount && stepCount > 1) && !onSkip && styles.footerSolo]}>
              {stepCount && stepCount > 1 ? (
                <View style={styles.dots} accessibilityLabel={`Step ${(step ?? 0) + 1} of ${stepCount}`}>
                  {Array.from({ length: stepCount }, (_, i) => (
                    <View key={i} style={[styles.dot, light && styles.dotLight, i === step && (light ? styles.dotActiveLight : styles.dotActive)]} />
                  ))}
                </View>
              ) : null}
              <View style={styles.actions}>
                {onSkip ? (
                  <PressableScale onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip tour" hitSlop={8}>
                    <Text style={[styles.skipText, light && styles.skipTextLight]}>Skip</Text>
                  </PressableScale>
                ) : null}
                <PressableScale
                  contentStyle={styles.dismissButton}
                  onPress={onPrimary ?? onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel}
                >
                  <Text style={[styles.dismissText, light && styles.titleLight]}>{primaryLabel}</Text>
                </PressableScale>
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const SCRIM = 'rgba(29,27,24,0.22)';
const SPOT_PAD = 6;

/** The scrim with a hole over the target, so the control itself stays lit. A
 *  square-ish target gets a circle; a wide one (a pill button) gets a pill,
 *  so the ring hugs it instead of ballooning across the screen. */
function Spotlight({ rect, shape }: { rect: { x: number; y: number; width: number; height: number }; shape: 'circle' | 'fit' }) {
  const { width, height } = useWindowDimensions();
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  if (shape === 'circle') {
    const r = Math.max(rect.width, rect.height) / 2 + SPOT_PAD;
    const hole = `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Path d={`M0 0 H${width} V${height} H0 Z ${hole}`} fill={SCRIM} fillRule="evenodd" />
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(251,250,247,0.9)" strokeWidth={1.5} />
        </Svg>
      </View>
    );
  }
  const w = rect.width + SPOT_PAD * 2;
  const h = rect.height + SPOT_PAD * 2;
  const x = rect.x - SPOT_PAD;
  const y = rect.y - SPOT_PAD;
  const r = Math.min(h, w) / 2;
  const hole = `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path d={`M0 0 H${width} V${height} H0 Z ${hole}`} fill={SCRIM} fillRule="evenodd" />
        <Path d={hole} fill="none" stroke="rgba(251,250,247,0.9)" strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  caretBottom: { top: undefined, bottom: -CARET_SIZE + 1 },
  caretLight: { backgroundColor: colors.background },
  cardLight: { backgroundColor: colors.background, boxShadow: '0 6px 24px rgba(0,0,0,0.35)' },
  titleLight: { color: colors.foreground },
  bodyLight: { color: colors.mutedForeground },
  dotLight: { backgroundColor: 'rgba(29,27,24,0.2)' },
  dotActiveLight: { backgroundColor: colors.foreground, width: 14 },
  skipTextLight: { color: colors.mutedForeground },
  scrim: { flex: 1, backgroundColor: SCRIM },
  scrimClear: { backgroundColor: 'transparent' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  footerSolo: { justifyContent: 'flex-start' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(251,250,247,0.35)' },
  dotActive: { backgroundColor: colors.background, width: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skipText: { color: 'rgba(251,250,247,0.7)', fontSize: typography.text.caption.fontSize },
  container: {
    position: 'absolute',
    zIndex: 3,
    maxWidth: 260,
  },
  caret: {
    position: 'absolute',
    top: -CARET_SIZE + 1,
    width: CARET_SIZE,
    height: CARET_SIZE,
    backgroundColor: colors.foreground,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.foreground,
    boxShadow: '0 4px 16px rgba(29,27,24,0.24)',
  },
  title: {
    color: colors.background,
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
  },
  body: {
    color: 'rgba(251,250,247,0.82)',
    fontSize: typography.text.caption.fontSize,
    lineHeight: 17,
  },
  dismissButton: {
    alignSelf: 'flex-start',
  },
  dismissText: {
    color: colors.background,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
});
