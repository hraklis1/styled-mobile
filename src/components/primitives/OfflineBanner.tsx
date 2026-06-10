import React, { useEffect, useRef, useState } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';

const STRIP_HEIGHT = 36;

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetInfo();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const hasBeenOffline = useRef(false);
  const translateY = useSharedValue(-200);

  useEffect(() => {
    if (isConnected === null) return;
    const totalHeight = STRIP_HEIGHT + insets.top;

    if (!isConnected) {
      hasBeenOffline.current = true;
      setShowBackOnline(false);
      translateY.value = withTiming(0, { duration: 300 });
    } else if (hasBeenOffline.current) {
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        translateY.value = withTiming(-totalHeight, { duration: 300 });
        setTimeout(() => {
          setShowBackOnline(false);
          hasBeenOffline.current = false;
        }, 350);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, insets.top, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const totalHeight = STRIP_HEIGHT + insets.top;

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: insets.top, height: totalHeight },
        showBackOnline ? styles.online : styles.offline,
        animStyle,
      ]}
    >
      <Text style={styles.text}>
        {showBackOnline ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 10,
  },
  offline: {
    backgroundColor: '#2D2D2D',
  },
  online: {
    backgroundColor: '#22C55E',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    paddingBottom: 8,
  },
});
