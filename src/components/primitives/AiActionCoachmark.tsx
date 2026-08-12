import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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
};

export function AiActionCoachmark({ visible, title, body, onDismiss, style, caretRight = 22 }: Props) {
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
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, style, { opacity, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <View style={[styles.caret, { right: caretRight }]} />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <PressableScale
          contentStyle={styles.dismissButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Got it"
        >
          <Text style={styles.dismissText}>Got it</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  body: {
    color: 'rgba(251,250,247,0.82)',
    fontSize: typography.size.xs,
    lineHeight: 17,
  },
  dismissButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  dismissText: {
    color: colors.background,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
});
