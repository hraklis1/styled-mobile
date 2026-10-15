import type { StyleProp, ViewStyle } from 'react-native';
import Reanimated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { motion } from '../../theme';

const STEP_MS = 70;

/**
 * One beat of a response's entrance: lede, then photographs, then reasoning,
 * then actions, each a step behind the last so the look assembles rather than
 * pops. Inert unless `active` (a reply that just arrived) and Reduce Motion is off.
 */
export function Reveal({ active, step, style, children }: { active: boolean; step: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const entering = active && !reduceMotion
    ? FadeInDown.duration(motion.slow - 100).delay(step * STEP_MS).easing(Easing.out(Easing.cubic)).withInitialValues({ transform: [{ translateY: 8 }] })
    : undefined;
  return <Reanimated.View style={style} entering={entering}>{children}</Reanimated.View>;
}
