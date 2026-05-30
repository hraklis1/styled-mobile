import React, { useRef, useEffect } from 'react';
import { Animated, View, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface Props {
  progress: number; // 0–100
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedProgressBar({
  progress,
  height = 6,
  color = colors.primary,
  trackColor = colors.muted,
  style,
}: Props) {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: Math.min(100, Math.max(0, progress)),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, animWidth]);

  const widthInterp = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: widthInterp,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
