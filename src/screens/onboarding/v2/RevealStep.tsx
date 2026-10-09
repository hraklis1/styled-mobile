import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { notificationAsync, NotificationFeedbackType } from '../../../lib/haptics';
import { colors, radii, spacing, typography } from '../../../theme';
import { PrimaryCTA } from '../components/PrimaryCTA';
import { AESTHETIC_IMAGES } from '../imagery';
import type { Reveal } from '../useRevealQuery';
import { visibleAesthetics } from './AestheticStep';

/** Hold the composing beat at least this long so it lands even on a cache hit. */
const MIN_COMPOSE_MS = 900;

const SLOT_LABELS: Record<string, string> = {
  outer: 'Layer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  accent: 'Finish',
};

/**
 * The payoff: a short "composing" beat, then the user's style read back to
 * them and a first look for today. Its CTAs lead into the one action that
 * makes everything after it personal — adding clothes.
 */
export function RevealStep({
  name,
  stylePreference,
  place,
  reveal,
  failed,
  onAddClothes,
  onExplore,
}: {
  name: string;
  stylePreference: string[];
  place: string | null;
  reveal: Reveal | undefined;
  failed: boolean;
  onAddClothes: () => void;
  onExplore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [minElapsed, setMinElapsed] = useState(false);
  const [line, setLine] = useState(0);
  const ready = minElapsed && (!!reveal || failed);

  const lines = useMemo(
    () => ['Reading your eye…', place ? `Checking the weather in ${place.split(',')[0]}…` : 'Checking the weather…', 'Putting a look together…'],
    [place],
  );

  useEffect(() => {
    const done = setTimeout(() => setMinElapsed(true), MIN_COMPOSE_MS);
    const tick = setInterval(() => setLine((n) => Math.min(n + 1, lines.length - 1)), 1100);
    return () => {
      clearTimeout(done);
      clearInterval(tick);
    };
  }, [lines.length]);

  useEffect(() => {
    if (ready) void notificationAsync(NotificationFeedbackType.Success);
  }, [ready]);

  const images = visibleAesthetics(stylePreference)
    .map((s) => AESTHETIC_IMAGES[s])
    .filter(Boolean)
    .slice(0, 3);

  if (!ready) {
    return (
      <View style={[s.composing, { paddingTop: insets.top }]} accessibilityLiveRegion="polite">
        <View style={s.stack}>
          {images.map((src, i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(i * 120).duration(400).reduceMotion(ReduceMotion.System)}
              style={[s.stackCard, { transform: [{ rotate: `${(i - 1) * 6}deg` }, { translateX: (i - 1) * 18 }], zIndex: i }]}
            >
              <Image source={src!} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Animated.View>
          ))}
        </View>
        <Animated.Text
          key={line}
          entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          style={s.composingText}
        >
          {lines[line]}
        </Animated.Text>
      </View>
    );
  }

  const enter = (i: number) =>
    FadeInDown.delay(i * 90).duration(380).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={enter(0)} style={s.eyebrow}>
          YOUR EDIT
        </Animated.Text>
        <Animated.Text entering={enter(1)} style={s.greeting} accessibilityRole="header">
          {name ? `Good to meet you, ${name}.` : 'Good to meet you.'}
        </Animated.Text>
        {reveal ? (
          <Animated.Text entering={enter(2)} style={s.read}>
            {reveal.styleRead}
          </Animated.Text>
        ) : null}

        {reveal ? (
          <Animated.View entering={enter(3)} style={s.card}>
            {images.length ? (
              <View style={s.strip} accessible={false} importantForAccessibility="no-hide-descendants">
                {images.map((src, i) => (
                  <Image key={i} source={src!} style={s.stripImage} contentFit="cover" />
                ))}
              </View>
            ) : null}
            <View style={s.cardBody}>
              <Text style={s.kicker}>TODAY'S LOOK</Text>
              <Text style={s.lookTitle}>{reveal.look.title}</Text>
              <View style={s.sheet}>
                {reveal.look.pieces.map((p, i) => (
                  <View key={`${p.slot}-${i}`} style={[s.sheetRow, i > 0 && s.sheetRule]}>
                    <Text style={s.slot}>{SLOT_LABELS[p.slot] ?? p.slot}</Text>
                    <Text style={s.piece}>{p.name}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.note}>{reveal.look.note}</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.Text entering={enter(2)} style={s.read}>
            You're set up. Add a few pieces and your stylist takes it from there.
          </Animated.Text>
        )}
      </ScrollView>

      <Animated.View entering={enter(4)} style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryCTA label="Start my wardrobe" onPress={onAddClothes} />
        <Text style={s.secondary} onPress={onExplore} accessibilityRole="button">
          Explore first
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  composing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: spacing.xxl ?? 40 },
  stack: { width: 160, height: 210, alignItems: 'center', justifyContent: 'center' },
  stackCard: {
    position: 'absolute',
    width: 130,
    height: 175,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  composingText: { ...typography.text.editorialItalic, color: colors.inkSubtle },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: { ...typography.text.eyebrowLarge, color: colors.primary, marginBottom: spacing.sm },
  greeting: { ...typography.text.editorialHero, color: colors.foreground, marginBottom: spacing.md },
  read: { ...typography.text.editorialItalic, fontSize: 20, lineHeight: 28, color: colors.foreground, marginBottom: spacing.xl },
  card: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  strip: { flexDirection: 'row', height: 120 },
  stripImage: { flex: 1 },
  cardBody: { padding: spacing.lg },
  kicker: { ...typography.text.masthead, color: colors.mutedForeground, marginBottom: spacing.xs },
  lookTitle: { ...typography.text.editorialTitle, color: colors.foreground, marginBottom: spacing.md },
  sheet: { marginBottom: spacing.md },
  sheetRow: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: spacing.sm, gap: spacing.md },
  sheetRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  slot: { ...typography.text.masthead, width: 64, color: colors.mutedForeground },
  piece: { ...typography.text.body, flex: 1, color: colors.foreground },
  note: { ...typography.text.bodySmall, color: colors.inkSubtle },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm, backgroundColor: colors.background },
  secondary: {
    ...typography.text.bodySmall,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
