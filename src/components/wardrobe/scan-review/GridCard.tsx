import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Filter, FeColorMatrix, Image as SvgImage } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence } from 'react-native-reanimated';

import { type PieceReviewState } from '../../../lib/scan-review';
import { colors, cutoutScaleFor, editorial, ingestion, motion, radii, spacing, surfaces, typography } from '../../../theme';
import { FlagDot } from './atoms';
import { RemoveBadge, SelectBadge } from './SelectBadge';
import { coverUri, matteUri, type ScanReviewPiece, type ScanReviewStage } from './types';


export const GridCard = memo(function GridCard({ piece, index, count, stage, state, width, selected, selecting, disabled, reduceMotion, restoreFocus, onPress, onToggle, onRemove, onAddBrand, brandRevision = 0 }: {
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
  /** Before extraction a piece is removed, not unticked; the grid offers Undo. */
  onRemove?: () => void;
  /** Before extraction an empty brand slot is a quiet "+ Brand" link. */
  onAddBrand?: () => void;
  /** Bumped when a batch brand lands on this piece; flashes the overline. */
  brandRevision?: number;
  reduceMotion: boolean;
  restoreFocus: boolean;
}) {
  const uri = coverUri(piece, stage);
  const isCutout = uri !== null && uri === piece.cutout;
  const plateHeight = Math.round(width / editorial.garmentAspectRatio);
  const inset = isCutout ? `${Math.round(cutoutScaleFor(piece.category) * 100)}%` as const : '100%' as const;
  // The crop is shown whole over its own matte; zooming to fill the 3:4
  // plate cut wide crops (a pair of shoes) down to a heel.
  const matte = matteUri(piece, stage);
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
    borderColor: withTiming(selecting ? (selected ? colors.foreground : 'transparent') : onRemove ? colors.hairline : included ? colors.foreground : 'transparent', { duration: reduceMotion ? 0 : motion.quick }),
    transform: [{ scale: withTiming(pressed.value && !reduceMotion ? ingestion.pressedScale : 1, { duration: reduceMotion ? 0 : motion.quick }) }],
  }));
  const flash = useSharedValue(0);
  useEffect(() => {
    if (brandRevision) flash.value = reduceMotion ? 0 : withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 90 }));
  }, [brandRevision, flash, reduceMotion]);
  const brandStyle = useAnimatedStyle(() => ({ opacity: 1 - flash.value * 0.6 }));
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
            {matte ? <Image source={{ uri: matte }} style={[StyleSheet.absoluteFill, { opacity: ingestion.matte.opacity }]} contentFit="cover" blurRadius={ingestion.matte.blurRadius} cachePolicy="memory-disk" recyclingKey={`${piece.id}-matte`} accessible={false} /> : null}
            <Animated.View style={[{ width: inset, height: inset, alignItems: 'center', justifyContent: 'center' }, imageStyle]}>
              {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={piece.id} />
                : <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />}
              {uri ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, desaturatedStyle]}>
                <Svg width="100%" height="100%">
                  <Defs><Filter id="muted"><FeColorMatrix type="saturate" values="0.65" /></Filter></Defs>
                  <SvgImage href={{ uri }} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" filter="url(#muted)" />
                </Svg>
              </Animated.View> : null}
            </Animated.View>
          </Animated.View>
          <View style={styles.caption}>
            {piece.brand ? <Animated.View style={brandStyle}><Text style={styles.brand} numberOfLines={1}>{piece.brand}</Text></Animated.View>
              : onAddBrand ? <Pressable onPress={onAddBrand} disabled={disabled} hitSlop={{ top: 10, bottom: 6, right: 24 }} accessibilityRole="button"
                accessibilityLabel={`Add a brand for ${piece.name || 'this piece'}, optional`} style={({ pressed }) => [styles.addBrand, pressed && { opacity: 0.5 }]}>
                <Ionicons name="add" size={12} color={colors.tertiary} /><Text style={styles.addBrandText}>Brand</Text>
              </Pressable> : null}
            <Text style={[styles.name, !included && styles.nameMuted]} numberOfLines={2}>{piece.name || 'Unnamed piece'}</Text>
            {!included ? <Text style={styles.hint}>Skipped</Text>
              : state === 'check' ? <View style={styles.checkRow}><FlagDot /><Text style={styles.hint}>Check details</Text></View> : null}
          </View>
        </View>
      </Pressable>
      {onRemove && !selecting ? <RemoveBadge onPress={onRemove} disabled={disabled} label={`Remove ${piece.name || 'piece'}`} style={styles.checkTarget} />
        : <SelectBadge checked={checked} onPress={onToggle} disabled={disabled} reduceMotion={reduceMotion}
          accessibilityLabel={`${selecting ? 'Edit' : 'Keep'} ${piece.name}`} style={styles.checkTarget} />}
    </View>
  );
});

const styles = StyleSheet.create({
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
  checkTarget: { position: 'absolute', top: 2, right: 2 },
  caption: { paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brand: { ...typography.text.eyebrow, color: colors.mutedForeground },
  addBrand: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  addBrandText: { ...typography.text.eyebrow, color: colors.tertiary },
  name: { ...typography.text.editorialCard, color: colors.foreground },
  nameMuted: { color: colors.mutedForeground },
});
