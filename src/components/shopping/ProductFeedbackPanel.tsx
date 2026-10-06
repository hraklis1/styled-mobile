import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, curatedProducts, radii, spacing, typography } from '../../theme';
import { offerImageCachePolicy, type ProductOffer } from '../../types/commerce';
import { productFeedbackOptions, type ProductFeedbackReason } from '../../lib/productFeedback';

/** How long the reason chips stay open before folding away (reopenable). */
export const REASON_WINDOW_MS = 8000;
/** After a reason is picked, a short beat to read the thanks before folding. */
const THANKS_MS = 1500;
const FADE_MS = 250;

/**
 * Stands in for a card the user just hid, for as long as they stay on the
 * page: a faint outline of the product keeps the rail from jumping and shows
 * what was hidden. The reason is optional and never rushed — the chips fold
 * away after a while but "Give a reason" brings them back, and Undo stays.
 */
export function ProductFeedbackPanel({ offer, width, imageAspectRatio, reason, onReason, onUndo }: {
  offer: ProductOffer; width: number; imageAspectRatio: number; reason: ProductFeedbackReason | null;
  onReason: (reason: ProductFeedbackReason) => void; onUndo: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  // True only right after a chip tap: show thanks, then fold sooner.
  const [justPicked, setJustPicked] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => { AccessibilityInfo.announceForAccessibility('Marked not for me. You can say why, or undo.'); }, []);
  useEffect(() => {
    if (!open) return;
    opacity.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      if (reduceMotion) { setOpen(false); return; }
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => { if (finished) setOpen(false); });
    }, justPicked ? THANKS_MS : REASON_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [open, justPicked, reduceMotion, opacity]);
  const reasonTitle = productFeedbackOptions.find((option) => option.id === reason)?.title;

  return <View style={[styles.panel, { width, minHeight: width / imageAspectRatio }]}>
    {offer.imageUrl ? <Image source={{ uri: offer.imageUrl }} style={styles.ghost} contentFit="contain" cachePolicy={offerImageCachePolicy(offer)} accessible={false} /> : null}
    <View style={styles.body}>
      {/* Named after the action (the ✕ is "Not for me"), not the mechanism. */}
      <Text style={styles.title}>{open && justPicked ? 'Thanks — we’ll show fewer like this.' : open ? 'Why not this one?' : 'Not for me'}</Text>
      {open && !justPicked ? <Text style={styles.meta}>Optional</Text> : null}
      {!open && reasonTitle ? <Text style={styles.meta}>{reasonTitle}</Text> : null}
      {open ? <Animated.View style={[styles.chips, { opacity }]}>
        {justPicked ? null : productFeedbackOptions.map((option) => <Pressable key={option.id} onPress={() => { setJustPicked(true); onReason(option.id); }} accessibilityRole="button" accessibilityState={{ selected: option.id === reason }} style={({ pressed }) => [styles.chip, option.id === reason && styles.chipSelected, pressed && styles.pressed]}>
          <Text style={[styles.chipText, option.id === reason && styles.chipTextSelected]}>{option.title}</Text>
        </Pressable>)}
      </Animated.View> : null}
      <View style={styles.actions}>
        <Pressable onPress={onUndo} accessibilityRole="button" accessibilityLabel={`Undo, show ${offer.title} again`} style={styles.action}><Text style={styles.link}>Undo</Text></Pressable>
        {!open ? <Pressable onPress={() => { setJustPicked(false); setOpen(true); }} accessibilityRole="button" style={styles.action}>
          <Text style={styles.link}>{reason ? 'Change reason' : 'Give a reason'}</Text>
        </Pressable> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch', borderRadius: radii.photo, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.controlOutline, overflow: 'hidden' },
  ghost: { position: 'absolute', top: spacing.md, bottom: spacing.md, left: spacing.md, right: spacing.md, opacity: 0.12 },
  body: { flex: 1, gap: spacing.sm, padding: spacing.md },
  title: { ...typography.text.label, color: colors.foreground },
  meta: { ...typography.text.caption, color: colors.mutedForeground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: 1, borderColor: colors.controlOutline, backgroundColor: colors.background },
  chipSelected: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  chipTextSelected: { color: colors.background },
  chipText: { ...typography.text.caption, color: colors.foreground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, marginTop: 'auto' },
  action: { minHeight: 44, justifyContent: 'center' },
  link: { ...typography.text.label, color: curatedProducts.accent },
  pressed: { opacity: 0.5 },
});
