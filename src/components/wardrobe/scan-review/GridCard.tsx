import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Filter, FeColorMatrix, Image as SvgImage } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence } from 'react-native-reanimated';

import { pieceFlags, type PieceReviewState, type ReviewField } from '../../../lib/scan-review';
import { colors, cutoutScaleFor, editorial, ingestion, motion, radii, spacing, surfaces, typography } from '../../../theme';
import { BrandPill } from './BrandPill';
import { FlagDot } from './atoms';
import type { CropOrigin } from '../CropAdjustModal';
import { SelectBadge } from './SelectBadge';
import { coverUri, type ScanReviewPiece, type ScanReviewStage } from './types';


const FIELD_NAMES: Record<ReviewField, string> = { name: 'name', category: 'category', color: 'colour', material: 'material', fit: 'details', brand: 'brand' };

/** "Check material", "Check colour & material" — the flag says what, not just that. */
function checkLabel(piece: ScanReviewPiece): string {
  if (piece.extractFailed) return 'Details missing';
  if (piece.possibleDuplicate) return 'Possible duplicate';
  const names = pieceFlags(piece).map(field => FIELD_NAMES[field]);
  if (!names.length) return 'Check details';
  return `Check ${names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(' & ')}`;
}

export const GridCard = memo(function GridCard({ piece, index, count, stage, state, width, selected, selecting, disabled, reduceMotion, restoreFocus, onPress, onToggle, onCrop, onBrand, brandRevision = 0 }: {
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
  /** When set, the plate opens the crop editor and the caption opens the loupe. */
  onCrop?: (origin: CropOrigin | null) => void;
  /** When set, the caption carries a tappable brand pill. */
  onBrand?: () => void;
  /** Bumped when a batch brand lands on this piece; flashes the overline. */
  brandRevision?: number;
  reduceMotion: boolean;
  restoreFocus: boolean;
}) {
  const uri = coverUri(piece, stage);
  const isCutout = uri !== null && uri === piece.cutout;
  const plateHeight = Math.round(width / editorial.garmentAspectRatio);
  // The crop is shown whole, inset on the plate; zooming to fill the 3:4
  // plate cut wide crops (a pair of shoes) down to a heel.
  const inset = `${Math.round((isCutout ? cutoutScaleFor(piece.category) : ingestion.printInset) * 100)}%` as const;
  const stateLabel = state === 'check' ? ', worth a look' : state === 'confirmed' ? ', confirmed' : '';

  const target = useRef<View>(null);
  const print = useRef<View>(null);
  // Hand the editor the print's window frame so the crop can zoom out of it.
  const openCrop = () => {
    const node = print.current;
    if (!onCrop) return;
    if (!node || !uri) { onCrop(null); return; }
    node.measureInWindow((x, y, w, h) => onCrop(w > 0 ? { x, y, width: w, height: h, uri } : null));
  };
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
    borderColor: withTiming(selecting && selected ? colors.foreground : colors.hairline, { duration: reduceMotion ? 0 : motion.quick }),
    transform: [{ scale: withTiming(reduceMotion ? 1 : pressed.value ? ingestion.pressedScale : included ? 1 : ingestion.skippedScale, { duration: reduceMotion ? 0 : motion.quick }) }],
  }));
  const settle = useSharedValue(1);
  const lastUri = useRef(uri);
  useEffect(() => {
    if (lastUri.current === uri) return;
    const recropped = lastUri.current !== null && uri !== null && !isCutout;
    lastUri.current = uri;
    if (recropped && !reduceMotion) settle.value = withSequence(withTiming(0.94, { duration: 120 }), withTiming(1, { duration: 260 }));
  }, [uri, isCutout, reduceMotion, settle]);
  const settleStyle = useAnimatedStyle(() => ({ transform: [{ scale: settle.value }] }));
  const flash = useSharedValue(0);
  useEffect(() => {
    if (brandRevision) flash.value = reduceMotion ? 0 : withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 90 }));
  }, [brandRevision, flash, reduceMotion]);
  const brandStyle = useAnimatedStyle(() => ({ opacity: 1 - flash.value * 0.6 }));
  const desaturatedStyle = useAnimatedStyle(() => ({ opacity: withTiming(included ? 0 : 1, { duration: reduceMotion ? 0 : motion.quick }) }));
  const imageStyle = useAnimatedStyle(() => ({ opacity: withTiming(included ? 1 : ingestion.excludedOpacity, { duration: reduceMotion ? 0 : motion.quick }) }));
  return (
    <View>
      <Pressable ref={target} onPress={onCrop ? openCrop : onPress} onLongPress={onToggle} delayLongPress={350} disabled={disabled}
        onPressIn={() => { pressed.value = true; }} onPressOut={() => { pressed.value = false; }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => ({ outlineWidth: focused ? 2 : 0, outlineColor: colors.foreground, backgroundColor: pressed ? colors.surfaceSelected : 'transparent' })}
        accessibilityRole="button" accessibilityState={{ disabled, selected: selecting ? selected : undefined }} accessibilityLabel={`${piece.name || 'Unnamed piece'}, ${index + 1} of ${count}${stateLabel}`}
        accessibilityHint={selecting ? 'Select for metadata editing' : onCrop ? 'Adjusts the crop. Long press to skip or keep.' : 'Inspect photos, brand and details'}
        accessibilityActions={onCrop ? [{ name: 'inspect', label: 'Inspect details' }, { name: 'toggle', label: included ? 'Skip piece' : 'Keep piece' }] : undefined}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'inspect') onPress(); else if (event.nativeEvent.actionName === 'toggle') onToggle(); }}>
        <View>
          <Animated.View style={[styles.plate, { height: plateHeight }, plateStyle]}>
            <Animated.View ref={print} style={[{ width: inset, height: inset, alignItems: 'center', justifyContent: 'center' }, imageStyle, settleStyle]}>
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
        </View>
      </Pressable>
      <Pressable onPress={onPress} disabled={disabled || !onCrop} accessible={false} style={styles.caption}>
        {onBrand ? <Animated.View style={brandStyle}><BrandPill brand={piece.brand} onPress={onBrand} disabled={disabled} name={piece.name} /></Animated.View>
          : piece.brand ? <Animated.View style={brandStyle}><Text style={styles.brand} numberOfLines={1}>{piece.brand}</Text></Animated.View> : null}
        <Text style={[styles.name, !included && styles.nameMuted]} numberOfLines={1}>{piece.name || 'Unnamed piece'}</Text>
        {!included ? <Text style={styles.hint}>Skipped</Text>
          : state === 'check' ? <View style={styles.checkRow}><FlagDot /><Text style={styles.hint} numberOfLines={1}>{checkLabel(piece)}</Text></View>
          : state === 'confirmed' ? <View style={styles.checkRow}><Ionicons name="checkmark" size={12} color={colors.mutedForeground} /><Text style={styles.hint}>Reviewed</Text></View> : null}
      </Pressable>
      <SelectBadge checked={checked} onPress={onToggle} disabled={disabled} reduceMotion={reduceMotion}
          accessibilityLabel={`${selecting ? 'Edit' : 'Keep'} ${piece.name}`} style={styles.checkTarget} />
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
  checkTarget: { position: 'absolute', top: 0, right: 0 },
  caption: { paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brand: { ...typography.text.eyebrow, color: colors.mutedForeground },
  name: { ...typography.text.editorialCard, color: colors.foreground },
  nameMuted: { color: colors.mutedForeground },
});
