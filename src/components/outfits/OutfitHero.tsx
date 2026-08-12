import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../theme';
import { PressableScale } from '../primitives/PressableScale';
import { OutfitCollage } from './OutfitCollage';
import type { Outfit } from '../../types/outfit';

const LOADING_PHRASES = [
  'Analyzing pieces...',
  'Arranging layout...',
  'Adding final polish...',
  'Styling your look...',
];

function FlatLayLoadingOverlay({ width }: { width: number }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.timing(textOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
        Animated.timing(textOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, 2500);
    return () => clearInterval(cycle);
  }, [textOpacity]);

  return (
    <View
      style={[overlayStyles.container, { width, height: width }]}
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel="Generating your flat-lay. This usually takes up to a minute."
    >
      <Animated.View
        style={{ ...StyleSheet.absoluteFill, opacity: pulseAnim, backgroundColor: colors.muted }}
      />
      <View style={overlayStyles.textBox}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Animated.Text style={[overlayStyles.phrase, { opacity: textOpacity }]}>
          {LOADING_PHRASES[phraseIndex]}
        </Animated.Text>
      </View>
    </View>
  );
}

type Props = {
  outfit: Outfit;
  width: number;
  hasAiImage: boolean;
  isGenerating: boolean;
  menuDisabled: boolean;
  menuOpen: boolean;
  onBack: () => void;
  onMenu: () => void;
  onGenerate: () => void;
};

export function OutfitHero({
  outfit,
  width,
  hasAiImage,
  isGenerating,
  menuDisabled,
  menuOpen,
  onBack,
  onMenu,
  onGenerate,
}: Props) {
  const insets = useSafeAreaInsets();

  const generateLabel = isGenerating
    ? `Generating flat-lay for ${outfit.name}`
    : hasAiImage
      ? `Regenerate flat-lay for ${outfit.name}`
      : `Generate flat-lay for ${outfit.name}`;

  return (
    <View style={styles.hero}>
      <OutfitCollage outfit={outfit} size={width} borderRadius={0} />

      {/*
        Scrims only over a real photo. The mosaic path renders a flat `colors.card`
        board with matted tiles, and a dark-to-transparent ramp over a solid fill
        bands badly — the ivory controls already read fine on it.
      */}
      {hasAiImage && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(29,27,24,0.30)', 'transparent']}
            style={[styles.scrimTop, { height: insets.top + 88 }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(29,27,24,0.34)']}
            style={styles.scrimBottom}
          />
        </>
      )}

      {isGenerating && <FlatLayLoadingOverlay width={width} />}

      <PressableScale
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        contentStyle={styles.backButtonSurface}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to closet"
      >
        <Ionicons name="chevron-back" size={22} color={colors.foreground} />
      </PressableScale>

      <PressableScale
        style={[styles.menuButton, { top: insets.top + spacing.sm }]}
        contentStyle={[styles.menuButtonSurface, menuDisabled && styles.disabled]}
        onPress={onMenu}
        disabled={menuDisabled}
        accessibilityRole="button"
        accessibilityLabel="More outfit actions"
        accessibilityState={{ expanded: menuOpen, disabled: menuDisabled }}
      >
        <Ionicons name="ellipsis-horizontal" size={21} color={colors.foreground} />
      </PressableScale>

      {/* The flat-lay control sits on the surface it replaces, never in a menu. */}
      <PressableScale
        style={[styles.generateChip, { top: insets.top + spacing.sm }]}
        contentStyle={[styles.generateChipSurface, isGenerating && styles.disabled]}
        onPress={onGenerate}
        disabled={isGenerating}
        accessibilityRole="button"
        accessibilityLabel={generateLabel}
        accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={hasAiImage ? 'refresh-outline' : 'sparkles-outline'}
            size={18}
            color={colors.primary}
          />
        )}
        <Text style={styles.generateChipLabel} numberOfLines={1}>
          {isGenerating ? 'Generating…' : hasAiImage ? 'Regenerate' : 'Flat-lay'}
        </Text>
      </PressableScale>

      {/*
        The AI disclosure carries its own background: it sits over an arbitrary
        generated photo, so contrast can't be left to the scrim.
      */}
      {hasAiImage && !isGenerating && (
        <View style={styles.caption} pointerEvents="none">
          <Text style={styles.captionText}>AI-generated · approximate</Text>
        </View>
      )}
    </View>
  );
}

const CONTROL_SIZE = 44;

const styles = StyleSheet.create({
  hero: { position: 'relative' },

  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 104,
    zIndex: 1,
  },

  backButton: {
    position: 'absolute',
    zIndex: 2,
    left: spacing.lg,
  },
  backButtonSurface: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderCurve: 'continuous',
    boxShadow: '0 2px 8px rgba(29,27,24,0.12)',
  },
  menuButton: {
    position: 'absolute',
    zIndex: 2,
    right: spacing.lg,
  },
  menuButtonSurface: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderCurve: 'continuous',
    boxShadow: '0 2px 8px rgba(29,27,24,0.10)',
  },

  generateChip: {
    position: 'absolute',
    zIndex: 2,
    right: spacing.lg + CONTROL_SIZE + spacing.sm,
    maxWidth: '54%',
  },
  generateChipSurface: {
    minHeight: CONTROL_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderCurve: 'continuous',
    boxShadow: '0 2px 8px rgba(29,27,24,0.14)',
  },
  generateChipLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },

  caption: {
    position: 'absolute',
    zIndex: 2,
    right: spacing.lg,
    bottom: spacing.lg + 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(29,27,24,0.42)',
  },
  captionText: {
    fontSize: 10,
    fontWeight: typography.weight.medium,
    color: 'rgba(255,252,247,0.95)',
  },

  disabled: { opacity: 0.5 },
});

const overlayStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(250, 248, 245, 0.85)',
    borderRadius: radii.full,
  },
  phrase: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
});
