import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import {
  useScanVisionPose,
  scanItemDirect,
  useCreateItem,
  type PoseScanItem,
} from '../../hooks/useItems';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radii } from '../../theme';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Item,
  type ItemCategory,
} from '../../types/item';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'menu' | 'scanning' | 'extracting' | 'review' | 'manual' | 'saving';

type QuickItem = {
  tempId: string;
  name: string;
  category: string | null;
  color: string | null;
  croppedImage: string | null;
  brand: string | null;
  subcategory: string | null;
  style: string | null;
  season: string | null;
  occasion: string | null;
  material: string | null;
  fit: string | null;
  pattern: string | null;
  neckline: string | null;
  care: string | null;
  formalityStyles: string[];
  notableDetails: string[];
  colorPalette: string[];
};

export interface QuickCaptureSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickCaptureSheet({ visible, onClose, onItemsSaved }: QuickCaptureSheetProps) {
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('menu');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [detectedItems, setDetectedItems] = useState<QuickItem[]>([]);
  const sessionRef = useRef(0);

  // Manual form state
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<ItemCategory | null>(null);
  const [manualColor, setManualColor] = useState('');
  const [manualBrand, setManualBrand] = useState('');

  const poseScan = useScanVisionPose();
  const createItem = useCreateItem();
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();

  useEffect(() => {
    if (!visible) {
      sessionRef.current += 1;
      setMode('menu');
      setImageDataUrl(null);
      setDetectedItems([]);
      setExtractionProgress({ current: 0, total: 0 });
      setManualName('');
      setManualCategory(null);
      setManualColor('');
      setManualBrand('');
      poseScan.reset();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (mode === 'saving' || mode === 'extracting' || mode === 'scanning') return;
    onClose();
  }, [mode, onClose]);

  const pickAndScan = async (source: 'camera' | 'library') => {
    const captured =
      source === 'camera'
        ? await launchCamera({ maxDim: 1600 })
        : await launchLibrary({ maxDim: 1600 });

    if (!captured) return;

    setImageDataUrl(captured.dataUrl);
    await runPoseScan(captured.dataUrl);
  };

  const runPoseScan = async (dataUrl: string) => {
    const session = sessionRef.current;
    setMode('scanning');

    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    try {
      const result = await poseScan.mutateAsync({ imageBase64: base64 });
      if (sessionRef.current !== session) return;

      if (!result.items || result.items.length === 0) {
        Alert.alert(
          'No clothing detected',
          'Try a clear photo with better lighting, or add the item manually.',
          [{ text: 'OK', onPress: () => { setMode('menu'); setImageDataUrl(null); } }],
        );
        return;
      }

      await runExtraction(result.items, dataUrl, session);
    } catch (err: any) {
      if (sessionRef.current !== session) return;
      Alert.alert(
        'Scan failed',
        err?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK', onPress: () => { setMode('menu'); setImageDataUrl(null); } }],
      );
    }
  };

  const runExtraction = async (
    poseItems: PoseScanItem[],
    fullImageDataUrl: string,
    session: number,
  ) => {
    setMode('extracting');
    setExtractionProgress({ current: 0, total: poseItems.length });

    let completedCount = 0;

    const settled = await Promise.allSettled(
      poseItems.map(async (poseItem, idx) => {
        if (sessionRef.current !== session) throw new Error('session_changed');

        const croppedImage = poseItem.croppedWebP
          ? `data:image/webp;base64,${poseItem.croppedWebP}`
          : null;
        const imageData = croppedImage ?? fullImageDataUrl;
        const otherItems = poseItems
          .filter((_, i) => i !== idx)
          .map((other) => `${other.name} (${other.category})`)
          .join(', ');

        const result = await scanItemDirect({
          imageData,
          outfitContext: otherItems || undefined,
        });

        if (sessionRef.current !== session) throw new Error('session_changed');

        completedCount += 1;
        setExtractionProgress({ current: completedCount, total: poseItems.length });

        return { result, croppedImage };
      }),
    );

    if (sessionRef.current !== session) return;

    const extracted: QuickItem[] = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      const { result, croppedImage } = s.value;
      extracted.push({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: result.name || 'Unknown Item',
        category: result.category ?? null,
        color: result.color ?? null,
        croppedImage,
        brand: result.brand ?? null,
        subcategory: result.subcategory ?? null,
        style: result.style ?? null,
        season: result.season ?? 'all',
        occasion: result.occasion ?? 'casual',
        material: result.material ?? null,
        fit: result.fit ?? null,
        pattern: result.pattern ?? null,
        neckline: result.neckline ?? null,
        care: result.care ?? null,
        formalityStyles: result.formalityStyles ?? [],
        notableDetails: result.notableDetails ?? [],
        colorPalette: result.colorPalette ?? [],
      });
    }

    if (extracted.length === 0) {
      Alert.alert(
        'Extraction failed',
        "Couldn't extract details. Please try again.",
        [{ text: 'OK', onPress: () => { setMode('menu'); setImageDataUrl(null); } }],
      );
      return;
    }

    setDetectedItems(extracted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode('review');
  };

  const removeItem = useCallback((tempId: string) => {
    setDetectedItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }, []);

  const handleSaveScanned = async () => {
    if (detectedItems.length === 0) return;
    const session = sessionRef.current;
    setMode('saving');

    const savedItems: Item[] = [];
    for (const item of detectedItems) {
      try {
        const created = await new Promise<Item>((resolve, reject) => {
          createItem.mutate(
            {
              name: item.name.trim() || 'Untitled',
              brand: item.brand || null,
              category: (item.category as ItemCategory) || null,
              subcategory: item.subcategory || null,
              color: item.color || null,
              style: item.style || null,
              season: item.season || null,
              occasion: item.occasion || null,
              material: item.material || null,
              fit: item.fit || null,
              pattern: item.pattern || null,
              neckline: item.neckline || null,
              care: item.care || null,
              formalityStyles: item.formalityStyles.length > 0 ? item.formalityStyles : undefined,
              notableDetails: item.notableDetails.length > 0 ? item.notableDetails : undefined,
              colorPalette: item.colorPalette.length > 0 ? item.colorPalette : undefined,
              imageUrl: item.croppedImage,
            },
            { onSuccess: resolve, onError: reject },
          );
        });
        if (sessionRef.current !== session) return;
        savedItems.push(created);
      } catch {
        // individual failures silently skipped
      }
    }

    if (sessionRef.current !== session) return;

    if (savedItems.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onItemsSaved?.(savedItems);
      onClose();
    } else {
      Alert.alert('Save failed', 'Could not save items. Please try again.');
      setMode('review');
    }
  };

  const handleSaveManual = () => {
    if (!manualName.trim()) return;
    const session = sessionRef.current;
    setMode('saving');

    createItem.mutate(
      {
        name: manualName.trim(),
        brand: manualBrand.trim() || null,
        category: manualCategory,
        color: manualColor.trim() || null,
      },
      {
        onSuccess: (created) => {
          if (sessionRef.current !== session) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onItemsSaved?.([created]);
          onClose();
        },
        onError: () => {
          if (sessionRef.current !== session) return;
          Alert.alert('Save failed', 'Could not save item. Please try again.');
          setMode('manual');
        },
      },
    );
  };

  const canClose = mode === 'menu' || mode === 'review' || mode === 'manual';

  const headerTitle =
    mode === 'menu' ? 'Quick Add'
    : mode === 'scanning' ? 'Scanning…'
    : mode === 'extracting' ? 'Extracting details…'
    : mode === 'saving' ? 'Adding to wardrobe…'
    : mode === 'manual' ? 'Add Manually'
    : detectedItems.length === 1 ? '1 item detected'
    : `${detectedItems.length} items detected`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={canClose ? handleClose : undefined}
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="camera" size={16} color={colors.primary} />
              <Text style={styles.headerTitle}>{headerTitle}</Text>
            </View>
            {canClose && (
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            {mode === 'menu' && (
              <MenuContent
                onCamera={() => pickAndScan('camera')}
                onLibrary={() => pickAndScan('library')}
                onManual={() => setMode('manual')}
              />
            )}

            {(mode === 'scanning' || mode === 'extracting') && (
              <ScanProgressView
                mode={mode}
                imageDataUrl={imageDataUrl}
                progress={extractionProgress}
              />
            )}

            {(mode === 'review' || mode === 'saving') && detectedItems.length > 0 && (
              <ReviewContent
                items={detectedItems}
                onRemove={removeItem}
                disabled={mode === 'saving'}
              />
            )}

            {mode === 'manual' && (
              <ManualForm
                name={manualName}
                category={manualCategory}
                color={manualColor}
                brand={manualBrand}
                onNameChange={setManualName}
                onCategoryChange={setManualCategory}
                onColorChange={setManualColor}
                onBrandChange={setManualBrand}
              />
            )}
          </ScrollView>

          {/* Save footer */}
          {(mode === 'review' || mode === 'saving') && detectedItems.length > 0 && (
            <SaveFooter
              label={
                mode === 'saving'
                  ? 'Adding to wardrobe…'
                  : detectedItems.length === 1
                  ? 'Add to wardrobe'
                  : `Add all ${detectedItems.length} to wardrobe`
              }
              loading={mode === 'saving'}
              onPress={handleSaveScanned}
            />
          )}

          {mode === 'manual' && (
            <SaveFooter
              label="Add to wardrobe"
              loading={false}
              disabled={!manualName.trim()}
              onPress={handleSaveManual}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── MenuContent ──────────────────────────────────────────────────────────────

function MenuContent({
  onCamera,
  onLibrary,
  onManual,
}: {
  onCamera: () => void;
  onLibrary: () => void;
  onManual: () => void;
}) {
  return (
    <View style={menuStyles.container}>
      <Text style={menuStyles.subtitle}>
        Snap a photo to instantly add items with AI, or enter details manually.
      </Text>

      <TouchableOpacity style={menuStyles.option} onPress={onCamera} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>Take Photo</Text>
          <Text style={menuStyles.optionSub}>Snap your item — AI fills in the details</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={menuStyles.option} onPress={onLibrary} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>Choose from Library</Text>
          <Text style={menuStyles.optionSub}>Pick from your camera roll</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={menuStyles.option} onPress={onManual} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: colors.muted }]}>
          <Ionicons name="pencil-outline" size={22} color={colors.mutedForeground} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>Enter Manually</Text>
          <Text style={menuStyles.optionSub}>Type the name, category, and colour</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const menuStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.5,
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  optionSub: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

// ─── ScanProgressView ─────────────────────────────────────────────────────────

const SCAN_MESSAGES = [
  'Analyzing your outfit…',
  'Identifying clothing items…',
  'Detecting colors & patterns…',
  'Reading style details…',
  'Almost there…',
];

function useCyclingScanStatus(active: boolean): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) { setIdx(0); return; }
    const id = setInterval(() => setIdx((i) => (i + 1) % SCAN_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, [active]);
  return SCAN_MESSAGES[idx];
}

function ScanProgressView({
  mode,
  imageDataUrl,
  progress,
}: {
  mode: 'scanning' | 'extracting';
  imageDataUrl: string | null;
  progress: { current: number; total: number };
}) {
  const statusMsg = useCyclingScanStatus(mode === 'scanning');
  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <View style={progressStyles.container}>
      {imageDataUrl && (
        <View style={progressStyles.previewBox}>
          <Image source={{ uri: imageDataUrl }} style={progressStyles.preview} resizeMode="cover" />
          <View style={progressStyles.dim} />
        </View>
      )}

      <View style={progressStyles.statusBox}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={progressStyles.statusTitle}>
          {mode === 'scanning' ? 'Detecting items…' : 'Extracting details…'}
        </Text>
        <Text style={progressStyles.statusSub}>
          {mode === 'scanning'
            ? statusMsg
            : progress.total > 0
            ? `${progress.current} / ${progress.total} items`
            : 'Working…'}
        </Text>
        {mode === 'extracting' && progress.total > 0 && (
          <View style={progressStyles.trackWrap}>
            <AnimatedProgressBar progress={pct} style={progressStyles.trackFlex} />
            <Text style={progressStyles.pct}>{pct}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  previewBox: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    height: 140,
    backgroundColor: colors.muted,
  },
  preview: { width: '100%', height: '100%' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  statusBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  statusTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  statusSub: { fontSize: typography.size.sm, color: colors.mutedForeground },
  trackWrap: {
    width: '100%',
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trackFlex: { flex: 1 },
  pct: { fontSize: typography.size.xs, color: colors.mutedForeground, minWidth: 28, textAlign: 'right' },
});

// ─── ReviewContent ────────────────────────────────────────────────────────────

function ReviewContent({
  items,
  onRemove,
  disabled,
}: {
  items: QuickItem[];
  onRemove: (tempId: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={reviewStyles.container}>
      <Text style={reviewStyles.hint}>
        Items will be saved as detected. Edit details from your wardrobe after saving.
      </Text>
      {items.map((item) => {
        const categoryLabel = item.category
          ? (CATEGORY_LABELS[item.category as ItemCategory] ?? item.category)
          : null;
        const metaLine = [categoryLabel, item.color].filter(Boolean).join(' · ');

        return (
          <View key={item.tempId} style={reviewStyles.card}>
            {/* Thumbnail */}
            <View style={reviewStyles.thumb}>
              {item.croppedImage ? (
                <Image source={{ uri: item.croppedImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
              )}
            </View>

            {/* Info */}
            <View style={reviewStyles.info}>
              <Text style={reviewStyles.name} numberOfLines={1}>{item.name}</Text>
              {metaLine.length > 0 && (
                <Text style={reviewStyles.meta} numberOfLines={1}>{metaLine}</Text>
              )}
            </View>

            {/* Remove */}
            {!disabled && (
              <TouchableOpacity
                onPress={() => onRemove(item.tempId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  hint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: typography.size.xs * 1.5,
    marginBottom: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, gap: 3 },
  name: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  meta: { fontSize: typography.size.sm, color: colors.mutedForeground },
});

// ─── ManualForm ───────────────────────────────────────────────────────────────

function ManualForm({
  name,
  category,
  color,
  brand,
  onNameChange,
  onCategoryChange,
  onColorChange,
  onBrandChange,
}: {
  name: string;
  category: ItemCategory | null;
  color: string;
  brand: string;
  onNameChange: (v: string) => void;
  onCategoryChange: (v: ItemCategory | null) => void;
  onColorChange: (v: string) => void;
  onBrandChange: (v: string) => void;
}) {
  return (
    <View style={formStyles.container}>
      {/* Name */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Item Name *</Text>
        <TextInput
          style={formStyles.input}
          value={name}
          onChangeText={onNameChange}
          placeholder="e.g. Navy Oxford Shirt"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
        />
      </View>

      {/* Category */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={formStyles.pillRow}>
            {CATEGORY_ORDER.map((cat) => {
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[formStyles.pill, active && formStyles.pillActive]}
                  onPress={() => onCategoryChange(active ? null : cat)}
                >
                  <Text style={[formStyles.pillText, active && formStyles.pillTextActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Color */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Colour</Text>
        <TextInput
          style={formStyles.input}
          value={color}
          onChangeText={onColorChange}
          placeholder="e.g. Navy Blue"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      {/* Brand */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Brand</Text>
        <TextInput
          style={formStyles.input}
          value={brand}
          onChangeText={onBrandChange}
          placeholder="e.g. Uniqlo"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  pillTextActive: { color: colors.primaryForeground },
});

// ─── SaveFooter ───────────────────────────────────────────────────────────────

function SaveFooter({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={footerStyles.container}>
      <TouchableOpacity
        style={[footerStyles.btn, (loading || disabled) && footerStyles.btnDisabled]}
        onPress={onPress}
        disabled={loading || disabled}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
        )}
        <Text style={footerStyles.btnText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: spacing.xl },
});
