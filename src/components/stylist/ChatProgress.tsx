import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { colors } from '../../theme';
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

// Says what the stylist is actually doing, from server progress events, instead of a generic wait.
export function TypingIndicator({ stage }: { stage: StylistProgressStage | null }) {
  const label = stage ? PROGRESS_COPY[stage] : 'Thinking it through…';
  return (
    <View style={styles.typingRow} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={styles.typingLabel}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Text style={styles.typingText}>{label}</Text>
      </View>
    </View>
  );
}
