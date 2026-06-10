import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle, DimensionValue } from 'react-native';

type Props = {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({ width, height, borderRadius = 8, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden' }, { opacity }, style]}>
      <LinearGradient
        colors={['#EAE5DF', '#F0EBE5', '#EAE5DF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
