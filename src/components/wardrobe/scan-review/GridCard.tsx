import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Filter, FeColorMatrix, Image as SvgImage } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence } from 'react-native-reanimated';

import { type PieceReviewState } from '../../../lib/scan-review';
import { colors, cutoutScaleFor, editorial, ingestion, motion, radii, spacing, stroke, surfaces, typography } from '../../../theme';
import { coverUri, type ScanReviewPiece, type ScanReviewStage } from './types';


export const GridCard = memo(function GridCard({ piece, index, count, stage, state, width, selected, selecting, disabled, reduceMotion, restoreFocus, onPress, onToggle, onBrand, onClearBrand, brandRevision = 0 }: {
  piece: ScanReviewPiece;
  index: number;
  count: number;
  stage: ScanReviewStage;
  state: PieceReviewState | null;
  width: number;
  selected: boolean;
  selecting: boolean;
  disabled: boolean;
  onPress: () => void;
  onToggle: () => void;
  onBrand: () => void;
  onClearBrand?: () => void;
  brandRevision?: number;
  reduceMotion: boolean;
  restoreFocus: boolean;
}) {
  const uri = coverUri(piece, stage);
  const isCutout = uri !== null && uri === piece.cutout;
  const plateHeight = Math.round(width / editorial.garmentAspectRatio);
  const inset = isCutout ? `${Math.round(cutoutScaleFor(piece.category) * 100)}%` as const : '100%' as const;
  // Editorial photo framing is presentation-only; the crop editor uses the source.
  const fit = isCutout ? 'contain' : 'cover';
  const stateLabel = state === 'check' ? ', worth a look' : state === 'confirmed' ? ', confirmed' : '';

  const target = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!restoreFocus) return;
    const timer = setTimeout(() => {
      const handle = findNodeHandle(target.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 150);
    return () => clearTimeout(timer);
  }, [restoreFocus]);
  const checked = selecting ? selected : piece.included !== false;
  const pressed = useSharedValue(false);
  const included = piece.included !== false;
  const plateStyle = useAnimatedStyle(() => ({
    borderColor: withTiming((selecting ? selected : included) ? colors.foreground : colors.border, { duration: reduceMotion ? 0 : motion.quick }),
    transform: [{ scale: withTiming(pressed.value && !reduceMotion ? ingestion.pressedScale : 1, { duration: reduceMotion ? 0 : motion.quick }) }],
  }));
  const flash = useSharedValue(0);
  useEffect(() => {
    if (brandRevision) flash.value = reduceMotion ? 0 : withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 90 }));
  }, [brandRevision, flash, reduceMotion]);
  const brandStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + flash.value * 0.025 }], backgroundColor: flash.value > 0.2 ? colors.surfaceSelected : colors.surfaceSubtle }));
  const desaturatedStyle = useAnimatedStyle(() => ({ opacity: withTiming(included ? 0 : 1, { duration: reduceMotion ? 0 : motion.quick }) }));
  const imageStyle = useAnimatedStyle(() => ({ opacity: withTiming(included ? 1 : ingestion.excludedOpacity, { duration: reduceMotion ? 0 : motion.quick }) }));
  return (
    <View>
      <Pressable ref={target} onPress={onPress} disabled={disabled}
        onPressIn={() => { pressed.value = true; }} onPressOut={() => { pressed.value = false; }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => ({ outlineWidth: focused ? 2 : 0, outlineColor: colors.foreground, backgroundColor: pressed ? colors.surfaceSelected : 'transparent' })}
        accessibilityRole="button" accessibilityState={{ disabled, selected: selecting ? selected : undefined }} accessibilityLabel={`${piece.name || 'Unnamed piece'}, ${index + 1} of ${count}${stateLabel}`}
        accessibilityHint={selecting ? 'Select for metadata editing' : 'Inspect photos, brand and details'}>
        <View>
          <Animated.View style={[styles.plate, { height: plateHeight }, plateStyle]}>
            <Animated.View style={[{ width: inset, height: inset, alignItems: 'center', justifyContent: 'center' }, imageStyle]}>
              {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit={fit} cachePolicy="memory-disk" recyclingKey={piece.id} />
                : <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />}
              {uri ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, desaturatedStyle]}>
                <Svg width="100%" height="100%">
                  <Defs><Filter id="muted"><FeColorMatrix type="saturate" values="0.65" /></Filter></Defs>
                  <SvgImage href={{ uri }} width="100%" height="100%" preserveAspectRatio={isCutout ? 'xMidYMid meet' : 'xMidYMid slice'} filter="url(#muted)" />
                </Svg>
              </Animated.View> : null}
            </Animated.View>
          </Animated.View>
          <View style={styles.caption}>
            {piece.sourceLabel ? <Text style={styles.hint}>{piece.sourceLabel}</Text> : null}
            <Text style={styles.name}>{piece.name || 'Unnamed piece'}</Text>
            {state === 'check' ? <Text style={styles.hint}>Check details</Text> : null}
          </View>
        </View>
      </Pressable>
      <Animated.View style={[styles.brandPill, brandStyle]}>
      <Pressable onPress={onBrand} disabled={disabled || selecting} accessibilityRole="button"
        accessibilityState={{ disabled: disabled || selecting }}
        accessibilityLabel={`Brand for ${piece.name}: ${piece.brand || 'Add brand'}`}
        style={({ pressed }) => [styles.brandLabel, pressed && { backgroundColor: colors.surfaceSelected }]}>
        <Ionicons name="pricetag-outline" size={14} color={colors.foreground} />
        <Text style={styles.brand}>{piece.brand || 'Add brand'}</Text>
      </Pressable>
      {piece.brand ? <Pressable onPress={onClearBrand} disabled={disabled || selecting}
        accessibilityRole="button" accessibilityLabel={`Clear brand for ${piece.name}`}
        accessibilityState={{ disabled: disabled || selecting }} style={styles.clear} hitSlop={2}>
        <Ionicons name="close" size={16} color={colors.foreground} />
      </Pressable> : null}
      </Animated.View>
      <Pressable hitSlop={2} onPress={onToggle} disabled={disabled} accessibilityRole="checkbox"
        accessibilityLabel={`${selecting ? 'Edit' : 'Keep'} ${piece.name}`}
        accessibilityState={{ checked, disabled }} style={styles.checkTarget}>
        <View style={[styles.selectRing, checked && styles.selectRingOn]}>
          {checked ? <Ionicons name="checkmark" size={14} color={colors.primaryForeground} /> : null}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  brandLabel: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  brandPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle, marginBottom: spacing.sm },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground },
  plate: {
    borderWidth: ingestion.activeBorder,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.photo,
    backgroundColor: surfaces.plate,
  },
  checkTarget: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  selectRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.fine,
    borderColor: colors.controlOutline,
    backgroundColor: colors.chromeTint,
  },
  selectRingOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  caption: { paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 1 },
  brand: { ...typography.text.label, color: colors.foreground, flexShrink: 1 },
  name: { ...typography.text.editorialCard, color: colors.foreground },
});
