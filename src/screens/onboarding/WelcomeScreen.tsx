import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Feature = { icon: keyof typeof Ionicons.glyphMap; label: string };
type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  features?: Feature[];
};

const SLIDES: Slide[] = [
  {
    key: 'discover',
    icon: 'shirt-outline',
    title: 'Dress with intent.',
    desc: 'Styled turns your wardrobe into a tool — scan, organise, and discover exactly what to wear every day.',
    features: [
      { icon: 'archive-outline',  label: 'Digital wardrobe' },
      { icon: 'layers-outline',   label: 'Outfit builder'   },
      { icon: 'sparkles',         label: 'AI Stylist'       },
    ],
  },
  {
    key: 'wardrobe',
    icon: 'camera-outline',
    title: 'Scan to add items\nin seconds.',
    desc: 'Point your camera at an outfit and Styled identifies each piece — colour, material, category, and more. No manual tagging required.',
  },
  {
    key: 'stylist',
    icon: 'sparkles',
    title: 'Your personal\nAI Stylist.',
    desc: 'Ask what to wear today, build outfits for upcoming events, or discover pieces missing from your wardrobe.',
  },
];

type Props = { onComplete: () => void };

export function WelcomeScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const isLast = activeIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const renderSlide = ({ item }: ListRenderItemInfo<Slide>) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={36} color={colors.primary} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.desc}>{item.desc}</Text>
      {item.features && (
        <View style={styles.featureRow}>
          {item.features.map((f) => (
            <View key={f.label} style={styles.featureChip}>
              <Ionicons name={f.icon} size={14} color={colors.primary} />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={styles.brandText}>Styled</Text>
        </View>
        <TouchableOpacity
          onPress={onComplete}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Skip introduction"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        style={styles.list}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.cta, { marginBottom: insets.bottom + spacing.lg }]}
        onPress={handleNext}
        activeOpacity={0.85}
        accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
      >
        <Text style={styles.ctaText}>{isLast ? 'Get started' : 'Next'}</Text>
        {!isLast && (
          <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
        )}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  skipText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    lineHeight: typography.size.xxxl * 1.2,
    marginBottom: spacing.lg,
  },
  desc: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    lineHeight: typography.size.md * 1.65,
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    minHeight: 52,
  },
  ctaText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
