import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyledWordmark } from '../../../components/brand/StyledWordmark';
import { colors, spacing, typography } from '../../../theme';
import { PrimaryCTA } from '../components/PrimaryCTA';
import { WELCOME_IMAGE } from '../imagery';

/**
 * One full-bleed editorial screen in place of the three-slide feature
 * carousel. It sets the register and asks for nothing; the reveal at the end
 * of the flow does the selling.
 */
export function WelcomeStep({ onBegin }: { onBegin: () => void }) {
  const insets = useSafeAreaInsets();
  const zoom = useSharedValue(1);

  // A slow Ken Burns drift. Skipped entirely under Reduce Motion.
  useEffect(() => {
    zoom.value = withTiming(1.06, { duration: 8000, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System });
  }, [zoom]);

  const drift = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  return (
    <View style={s.root}>
      <View style={s.hero} accessible={false} importantForAccessibility="no-hide-descendants">
        <Animated.View style={[StyleSheet.absoluteFill, drift]}>
          <Image source={WELCOME_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        </Animated.View>
        <LinearGradient
          colors={['rgba(251,250,247,0)', 'rgba(251,250,247,0.6)', colors.background]}
          locations={[0.4, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[s.top, { paddingTop: insets.top + spacing.md }]}>
        <StyledWordmark style={s.wordmark} />
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={s.title} accessibilityRole="header">
          Your wardrobe,{'\n'}edited.
        </Text>
        <Text style={s.sub}>Tell us four things. We'll style the rest.</Text>
        <PrimaryCTA label="Begin" onPress={onBegin} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '28%', overflow: 'hidden' },
  top: { paddingHorizontal: spacing.xl },
  wordmark: { width: 112, height: 33 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl },
  title: { ...typography.text.editorialHero, fontSize: 44, lineHeight: 48, color: colors.foreground, marginBottom: spacing.md },
  sub: { ...typography.text.body, color: colors.inkSubtle, marginBottom: spacing.xl },
});
