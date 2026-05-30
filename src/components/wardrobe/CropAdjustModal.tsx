import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

export type Bbox = { x: number; y: number; width: number; height: number };

const MIN_FRAC = 0.10;
const CORNER_HIT = 44;

type Corner = 'tl' | 'tr' | 'bl' | 'br';
type Mode = 'pan' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'pinch' | null;

// ─── Pure math helpers ────────────────────────────────────────────────────────

function computeDisplayBounds(cW: number, cH: number, natW: number, natH: number) {
  const scale = Math.min(cW / natW, cH / natH);
  const dw = natW * scale;
  const dh = natH * scale;
  return { x: (cW - dw) / 2, y: (cH - dh) / 2, w: dw, h: dh };
}

function clampCenter(cx: number, cy: number, wPx: number, hPx: number, natW: number, natH: number) {
  return {
    cx: Math.max(wPx / (2 * natW), Math.min(1 - wPx / (2 * natW), cx)),
    cy: Math.max(hPx / (2 * natH), Math.min(1 - hPx / (2 * natH), cy)),
  };
}

function getFrameRect(
  bounds: { x: number; y: number; w: number; h: number },
  natW: number,
  cx: number, cy: number,
  wPx: number, hPx: number,
) {
  const scale = bounds.w / natW;
  const fw = wPx * scale;
  const fh = hPx * scale;
  return {
    left: bounds.x + cx * bounds.w - fw / 2,
    top:  bounds.y + cy * bounds.h - fh / 2,
    width: fw,
    height: fh,
  };
}

function hitCorner(
  lx: number, ly: number,
  frame: { left: number; top: number; width: number; height: number },
): Corner | null {
  const HALF = CORNER_HIT / 2;
  const pts: Array<{ key: Corner; x: number; y: number }> = [
    { key: 'tl', x: frame.left,               y: frame.top },
    { key: 'tr', x: frame.left + frame.width,  y: frame.top },
    { key: 'bl', x: frame.left,               y: frame.top + frame.height },
    { key: 'br', x: frame.left + frame.width,  y: frame.top + frame.height },
  ];
  for (const { key, x, y } of pts) {
    if (Math.abs(lx - x) <= HALF && Math.abs(ly - y) <= HALF) return key;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  sourceImage: string;
  initialBbox: Bbox | null;
  itemName: string;
  onApply: (bbox: Bbox) => void;
  onCancel: () => void;
}

export function CropAdjustModal({ visible, sourceImage, initialBbox, itemName, onApply, onCancel }: Props) {
  const insets = useSafeAreaInsets();

  const [nat, setNat]             = useState<{ w: number; h: number } | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [bounds, setBounds]       = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cx, setCx]               = useState(0.5);
  const [cy, setCy]               = useState(0.5);
  const [widthPx, setWidthPx]     = useState(0);
  const [heightPx, setHeightPx]   = useState(0);

  // Shadow refs — accessed inside PanResponder without closure staleness
  const cxRef = useRef(0.5);
  const cyRef = useRef(0.5);
  const wRef  = useRef(0);
  const hRef  = useRef(0);
  const boundsRef = useRef<typeof bounds>(null);
  const natRef    = useRef<typeof nat>(null);
  const containerRef    = useRef<View>(null);
  const containerOffset = useRef({ x: 0, y: 0 });

  cxRef.current     = cx;
  cyRef.current     = cy;
  wRef.current      = widthPx;
  hRef.current      = heightPx;
  boundsRef.current = bounds;
  natRef.current    = nat;

  const modeRef  = useRef<Mode>(null);
  const startRef = useRef<{
    cx?: number; cy?: number;
    fixedX?: number; fixedY?: number;
    dist?: number; wPx?: number; hPx?: number;
  } | null>(null);

  // Reset when closed
  useEffect(() => {
    if (!visible) {
      setNat(null); setBounds(null);
      setCx(0.5); setCy(0.5); setWidthPx(0); setHeightPx(0);
    }
  }, [visible]);

  // Get natural dimensions when image/visibility changes
  useEffect(() => {
    if (!visible || !sourceImage) return;
    Image.getSize(
      sourceImage,
      (w, h) => {
        if (!w || !h) return;
        setNat({ w, h });
        const bbox = initialBbox ?? { x: 10, y: 10, width: 80, height: 80 };
        const initCx = (bbox.x + bbox.width / 2) / 100;
        const initCy = (bbox.y + bbox.height / 2) / 100;
        const minW = Math.round(w * MIN_FRAC);
        const minH = Math.round(h * MIN_FRAC);
        const initW = Math.max(minW, Math.min(w, Math.round((bbox.width * w) / 100)));
        const initH = Math.max(minH, Math.min(h, Math.round((bbox.height * h) / 100)));
        const safe = clampCenter(initCx, initCy, initW, initH, w, h);
        setCx(safe.cx); setCy(safe.cy);
        setWidthPx(initW); setHeightPx(initH);
      },
      () => {},
    );
  }, [visible, sourceImage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute display bounds when container or image changes
  useEffect(() => {
    if (!nat || !containerW || !containerH) return;
    setBounds(computeDisplayBounds(containerW, containerH, nat.w, nat.h));
  }, [nat, containerW, containerH]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length >= 2) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        modeRef.current  = 'pinch';
        startRef.current = { dist: Math.sqrt(dx * dx + dy * dy), wPx: wRef.current, hPx: hRef.current };
        return;
      }

      const b = boundsRef.current;
      const n = natRef.current;
      if (!b || !n) { modeRef.current = null; return; }

      const localX = gestureState.x0 - containerOffset.current.x;
      const localY = gestureState.y0 - containerOffset.current.y;
      const frame  = getFrameRect(b, n.w, cxRef.current, cyRef.current, wRef.current, hRef.current);
      const corner = hitCorner(localX, localY, frame);

      if (corner) {
        const scale   = b.w / n.w;
        const fw      = wRef.current * scale;
        const fh      = hRef.current * scale;
        const frameCx = b.x + cxRef.current * b.w;
        const frameCy = b.y + cyRef.current * b.h;
        modeRef.current  = `resize-${corner}` as Mode;
        startRef.current = {
          fixedX: (corner === 'tl' || corner === 'bl') ? frameCx + fw / 2 : frameCx - fw / 2,
          fixedY: (corner === 'tl' || corner === 'tr') ? frameCy + fh / 2 : frameCy - fh / 2,
        };
      } else {
        modeRef.current  = 'pan';
        startRef.current = { cx: cxRef.current, cy: cyRef.current };
      }
    },

    onPanResponderMove: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches;
      const b = boundsRef.current;
      const n = natRef.current;
      if (!b || !n) return;

      if (touches.length >= 2) {
        const dx   = touches[0].pageX - touches[1].pageX;
        const dy   = touches[0].pageY - touches[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (modeRef.current !== 'pinch') {
          modeRef.current  = 'pinch';
          startRef.current = { dist, wPx: wRef.current, hPx: hRef.current };
          return;
        }
        const s = startRef.current;
        if (!s?.dist) return;
        const ratio = dist / s.dist;
        const minW  = Math.round(n.w * MIN_FRAC);
        const minH  = Math.round(n.h * MIN_FRAC);
        const newW  = Math.max(minW, Math.min(n.w, Math.round((s.wPx ?? wRef.current) * ratio)));
        const newH  = Math.max(minH, Math.min(n.h, Math.round((s.hPx ?? hRef.current) * ratio)));
        const safe  = clampCenter(cxRef.current, cyRef.current, newW, newH, n.w, n.h);
        setCx(safe.cx); setCy(safe.cy);
        setWidthPx(newW); setHeightPx(newH);
        return;
      }

      const mode = modeRef.current;
      const s    = startRef.current;

      if (mode === 'pan' && s) {
        const newCx = (s.cx ?? cxRef.current) + gestureState.dx / b.w;
        const newCy = (s.cy ?? cyRef.current) + gestureState.dy / b.h;
        const safe  = clampCenter(newCx, newCy, wRef.current, hRef.current, n.w, n.h);
        setCx(safe.cx); setCy(safe.cy);
      } else if (mode?.startsWith('resize-') && s?.fixedX !== undefined && s.fixedY !== undefined) {
        const localX = gestureState.moveX - containerOffset.current.x;
        const localY = gestureState.moveY - containerOffset.current.y;
        const scale  = b.w / n.w;
        const absX   = Math.abs(localX - s.fixedX);
        const absY   = Math.abs(localY - s.fixedY);
        const minW   = Math.round(n.w * MIN_FRAC);
        const minH   = Math.round(n.h * MIN_FRAC);
        const newW   = Math.max(minW, Math.min(n.w, Math.round(absX / scale)));
        const newH   = Math.max(minH, Math.min(n.h, Math.round(absY / scale)));
        const signX  = localX >= s.fixedX ? 1 : -1;
        const signY  = localY >= s.fixedY ? 1 : -1;
        const newCx  = (s.fixedX + signX * newW * scale / 2 - b.x) / b.w;
        const newCy  = (s.fixedY + signY * newH * scale / 2 - b.y) / b.h;
        const safe   = clampCenter(newCx, newCy, newW, newH, n.w, n.h);
        setCx(safe.cx); setCy(safe.cy);
        setWidthPx(newW); setHeightPx(newH);
      }
    },

    onPanResponderRelease:   () => { modeRef.current = null; startRef.current = null; },
    onPanResponderTerminate: () => { modeRef.current = null; startRef.current = null; },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoom = useCallback((dir: 1 | -1) => {
    const n = natRef.current;
    if (!n) return;
    const factor = 1 + dir * 0.10;
    const minW   = Math.round(n.w * MIN_FRAC);
    const minH   = Math.round(n.h * MIN_FRAC);
    const newW   = Math.max(minW, Math.min(n.w, Math.round(wRef.current * factor)));
    const newH   = Math.max(minH, Math.min(n.h, Math.round(hRef.current * factor)));
    const safe   = clampCenter(cxRef.current, cyRef.current, newW, newH, n.w, n.h);
    setCx(safe.cx); setCy(safe.cy);
    setWidthPx(newW); setHeightPx(newH);
  }, []);

  const handleApply = useCallback(() => {
    const n = natRef.current;
    if (!n || wRef.current <= 0 || hRef.current <= 0) return;
    const hx = wRef.current / (2 * n.w);
    const hy = hRef.current / (2 * n.h);
    onApply({
      x:      Math.max(0, cxRef.current - hx) * 100,
      y:      Math.max(0, cyRef.current - hy) * 100,
      width:  (wRef.current / n.w) * 100,
      height: (hRef.current / n.h) * 100,
    });
  }, [onApply]);

  // Render frame from reactive state
  const frame = (bounds && nat && widthPx > 0 && heightPx > 0)
    ? getFrameRect(bounds, nat.w, cx, cy, widthPx, heightPx)
    : null;

  const canApply = !!(nat && widthPx > 0 && heightPx > 0);

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onCancel}>
      <View style={[s.root, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Adjust crop</Text>
          <Text style={s.subtitle}>Drag to move · corners to resize · pinch to zoom</Text>
        </View>

        {/* Canvas */}
        <View
          ref={containerRef}
          style={s.canvas}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerW(width);
            setContainerH(height);
            containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
              containerOffset.current = { x: pageX, y: pageY };
            });
          }}
          {...panResponder.panHandlers}
        >
          {/* Source image */}
          <Image
            source={{ uri: sourceImage }}
            style={[
              s.image,
              bounds
                ? { left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }
                : { top: 0, left: 0, right: 0, bottom: 0 },
            ]}
            resizeMode="contain"
            accessibilityLabel={itemName}
          />

          {frame && (
            <>
              {/* Dim overlays */}
              <View style={[s.dim, { top: 0, left: 0, right: 0, height: frame.top }]} />
              <View style={[s.dim, { left: 0, right: 0, top: frame.top + frame.height, bottom: 0 }]} />
              <View style={[s.dim, { left: 0, top: frame.top, width: frame.left, height: frame.height }]} />
              <View style={[s.dim, { left: frame.left + frame.width, right: 0, top: frame.top, height: frame.height }]} />

              {/* Crop frame */}
              <View
                pointerEvents="none"
                style={[s.cropFrame, { left: frame.left, top: frame.top, width: frame.width, height: frame.height }]}
              >
                {/* Rule-of-thirds grid */}
                <View style={s.gridV1} />
                <View style={s.gridV2} />
                <View style={s.gridH1} />
                <View style={s.gridH2} />

                {/* Corner handles (visual only — gestures are on the whole canvas) */}
                <View style={[s.corner, s.cornerTL]}><View style={s.cornerDot} /></View>
                <View style={[s.corner, s.cornerTR]}><View style={s.cornerDot} /></View>
                <View style={[s.corner, s.cornerBL]}><View style={s.cornerDot} /></View>
                <View style={[s.corner, s.cornerBR]}><View style={s.cornerDot} /></View>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TouchableOpacity style={s.iconBtn} onPress={() => handleZoom(1)} accessibilityLabel="Zoom out">
            <Ionicons name="remove" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => handleZoom(-1)} accessibilityLabel="Zoom in">
            <Ionicons name="add" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Ionicons name="close" size={15} color={colors.foreground} />
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.applyBtn, !canApply && s.applyBtnDisabled]}
            onPress={handleApply}
            disabled={!canApply}
          >
            <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />
            <Text style={s.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  canvas: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  image: {
    position: 'absolute',
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  gridV1: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: '33.33%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridV2: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: '66.67%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridH1: {
    position: 'absolute',
    left: 0, right: 0,
    top: '33.33%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridH2: {
    position: 'absolute',
    left: 0, right: 0,
    top: '66.67%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_HIT,
    height: CORNER_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTL: { top: 0, left: 0, transform: [{ translateX: -CORNER_HIT / 2 }, { translateY: -CORNER_HIT / 2 }] },
  cornerTR: { top: 0, right: 0, transform: [{ translateX: CORNER_HIT / 2 }, { translateY: -CORNER_HIT / 2 }] },
  cornerBL: { bottom: 0, left: 0, transform: [{ translateX: -CORNER_HIT / 2 }, { translateY: CORNER_HIT / 2 }] },
  cornerBR: { bottom: 0, right: 0, transform: [{ translateX: CORNER_HIT / 2 }, { translateY: CORNER_HIT / 2 }] },
  cornerDot: {
    width: 20,
    height: 20,
    backgroundColor: colors.white,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primaryForeground,
  },
});
