import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { StylistProgressStage } from '../../features/stylist/types';
import { styles } from './ChatStyles';

// ── LookCarousel ─────────────────────────────────────────────────────────────
// Alternate looks side by side; the dots make it obvious there is more than one.

export function LookCarousel({ width, count, children }: { width: number; count: number; children: React.ReactNode }) {
  const [page, setPage] = useState(0);
  const step = width - 48;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={step} accessibilityLabel={`Outfit options, ${page + 1} of ${count}`}
        scrollEventThrottle={64} onScroll={(e) => setPage(Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / step))))}>
        {children}
      </ScrollView>
      <View style={styles.carouselDots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: count }, (_, i) => <View key={i} style={[styles.carouselDot, i === page && styles.carouselDotActive]} />)}
      </View>
    </View>
  );
}

// ── TypingIndicator ───────────────────────────────────────────────────────────

const PROGRESS_COPY: Record<StylistProgressStage, string> = {
  wardrobe: 'Going through your wardrobe…',
  outfits: 'Looking at what you’ve worn and saved…',
  weather: 'Checking the forecast…',
  products: 'Finding pieces worth buying…',
  memory: 'Recalling what you’ve told me…',
};

// Says what the stylist is actually doing, from server progress events, instead of
// a generic wait. Set in the editorial italic with a slow breathing mark, and the
// line cross-fades when the stage changes; quiet placeholder lines hold the space
// the reply will land in so the thread doesn't jump when it arrives.
export function TypingIndicator({ stage }: { stage: StylistProgressStage | null }) {
  const label = stage ? PROGRESS_COPY[stage] : 'Thinking it through…';
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0.35);
  useEffect(() => {
    if (reduceMotion) { breath.set(0.7); return; }
    breath.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [breath, reduceMotion]);
  const breathing = useAnimatedStyle(() => ({ opacity: breath.get() }));
  const placeholder = useAnimatedStyle(() => ({ opacity: 0.35 + breath.get() * 0.35 }));

  return (
    <View style={styles.typingRow} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={styles.typingLabel}>
        <Reanimated.View style={[styles.typingMark, breathing]} />
        <Reanimated.View
          key={label}
          entering={reduceMotion ? undefined : FadeIn.duration(280)}
          exiting={reduceMotion ? undefined : FadeOut.duration(160)}
        >
          <Text style={styles.typingText}>{label}</Text>
        </Reanimated.View>
      </View>
      <Reanimated.View style={[styles.typingPlaceholder, placeholder]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.typingPlaceholderLine, { width: '92%' }]} />
        <View style={[styles.typingPlaceholderLine, { width: '78%' }]} />
        <View style={[styles.typingPlaceholderLine, { width: '54%' }]} />
      </Reanimated.View>
    </View>
  );
}
