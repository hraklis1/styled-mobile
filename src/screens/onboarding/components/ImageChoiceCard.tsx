import React, { useEffect } from 'react';
import { ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '../../../theme';

/**
 * A photographic choice card. Selection is an ink border plus a numbered
 * badge (pick order), never a colour fill — borders read editorial, fills
 * read app.
 *
 * With no image it falls back to a typographic card: the label set large in
 * the serif over two soft tones, which reads as intentional rather than
 * missing.
 */
export function ImageChoiceCard({
  label,
  description,
  image,
  tones,
  selected,
  order,
  dimmed,
  aspectRatio = 3 / 4,
  shakeSignal,
  onPress,
}: {
  label: string;
  description?: string;
  image?: ImageSourcePropType;
  tones: [string, string];
  selected: boolean;
  /** 1-based pick order; shown as a badge when selected. */
  order?: number;
  dimmed?: boolean;
  aspectRatio?: number;
  /** Increment to shake the card (e.g. a pick past the cap). */
  shakeSignal?: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!shakeSignal) return;
    const t = (v: number) => withTiming(v, { duration: 50, reduceMotion: ReduceMotion.System });
    shake.value = withSequence(t(-6), t(6), t(-4), t(4), t(0));
  }, [shake, shakeSignal]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shake.value }],
  }));

  return (
    <Animated.View style={[motion, { opacity: dimmed ? 0.55 : 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 300, reduceMotion: ReduceMotion.System });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 220, reduceMotion: ReduceMotion.System });
        }}
        accessibilityRole="button"
        accessibilityLabel={description ? `${label}. ${description}` : label}
        accessibilityState={{ selected }}
        style={[s.card, { aspectRatio }, selected && s.cardSelected]}
      >
        {image ? (
          <>
            <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            <LinearGradient
              colors={['transparent', 'rgba(20,18,16,0.55)']}
              locations={[0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <LinearGradient colors={tones} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}

        <View style={s.caption}>
          <Text style={[s.label, image ? s.onImage : null]} numberOfLines={1}>
            {label}
          </Text>
          {description && !image ? (
            <Text style={s.desc} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>

        {selected && order != null ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{order}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.card,
  },
  cardSelected: { borderColor: colors.foreground },
  caption: { padding: spacing.md, gap: 2 },
  label: { ...typography.text.editorialItalic, fontSize: 22, lineHeight: 26, color: colors.foreground },
  onImage: { color: '#FFFCF7' },
  desc: { fontSize: typography.text.caption.fontSize, lineHeight: 16, color: colors.inkSubtle },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
    fontVariant: ['tabular-nums'],
  },
});
