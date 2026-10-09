import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';

const DURATION = 280;
const EASE = Easing.out(Easing.cubic);

/**
 * Shared-axis horizontal transition between steps: the outgoing step drifts
 * ~25pt and fades while the incoming one arrives from the other side. Back
 * reverses the axis so the motion always matches the direction of travel.
 *
 * Both steps are briefly mounted at once, so each is absolutely filled to
 * overlap rather than stack. Runs on the UI thread; collapses to an instant
 * swap when the system Reduce Motion setting is on.
 */
export function StepTransition({
  stepKey,
  direction,
  children,
}: {
  stepKey: string;
  direction: 'forward' | 'back';
  children: React.ReactNode;
}) {
  const forward = direction === 'forward';
  const entering = (forward ? FadeInRight : FadeInLeft).duration(DURATION).easing(EASE).reduceMotion(ReduceMotion.System);
  const exiting = (forward ? FadeOutLeft : FadeOutRight).duration(DURATION * 0.7).easing(EASE).reduceMotion(ReduceMotion.System);

  return (
    <View style={s.stage}>
      <Animated.View key={stepKey} entering={entering} exiting={exiting} style={StyleSheet.absoluteFill}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  stage: { flex: 1 },
});
