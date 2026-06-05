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
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';
import {
  useScanVisionPose,
  scanItemDirect,
  useCreateItem,
  useBrandSuggestions,
  type PoseScanItem,
} from '../../hooks/useItems';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, type Item, type ItemCategory } from '../../types/item';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { SizeProfileInput } from '../primitives/SizeProfileInput';
import type { SizeProfile } from '../../lib/sizes';
import { CropAdjustModal, type Bbox } from './CropAdjustModal';
import { cropImage } from '../../lib/cropImage';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'scanning' | 'extracting' | 'review' | 'saving';

type EditableItem = {
  tempId: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  pattern: string | null;
  neckline: string | null;
  care: string | null;
  formalityStyles: string[];
  notableDetails: string[];
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  warmthRating: number | null;
  croppedImage: string | null;
  expanded: boolean;
  sizeProfile: SizeProfile | null;
  bbox: Bbox | null;
  sourceImage: string | null;
};

interface ScanItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScanItemSheet({ visible, onClose, onItemsSaved }: ScanItemSheetProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<EditableItem[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [extractedThumbs, setExtractedThumbs] = useState<string[]>([]);
  const sessionRef = useRef(0);
  const [cropAdjustTarget, setCropAdjustTarget] = useState<{
    tempId: string;
    sourceImage: string;
    bbox: Bbox;
    itemName: string;
  } | null>(null);

  const { user } = useAuth();
  const poseScan = useScanVisionPose();
  const createItem = useCreateItem();
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();

  useEffect(() => {
    if (!visible) {
      sessionRef.current += 1;
      setPhase('idle');
      setImageDataUrl(null);
      setDetectedItems([]);
      setExtractedThumbs([]);
      setExtractionProgress({ current: 0, total: 0 });
      setCropAdjustTarget(null);
      poseScan.reset();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (phase === 'saving' || phase === 'extracting') return;
    onClose();
  }, [phase, onClose]);

  const pickImage = async (source: 'camera' | 'library') => {
    // Both hooks handle permission checks, denial alerts, and compression internally
    const captured =
      source === 'camera'
        ? await launchCamera({ maxDim: 1024, compress: 0.8 })
        : await launchLibrary({ maxDim: 1024, compress: 0.8 });

    if (!captured) return;

    setImageDataUrl(captured.dataUrl);
    // Pass the local file URI so runPoseScan can downscale without re-encoding the data URL
    await runPoseScan(captured.uri, captured.dataUrl);
  };

  const runPoseScan = async (sourceUri: string, displayDataUrl: string) => {
    const session = sessionRef.current;
    setPhase('scanning');

    // Downscale to 512 px for pose detection — bounding boxes don't benefit from higher res
    // and this roughly halves token cost at the OpenAI Vision "low" detail tier.
    const poseFrame = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 512 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    const base64 = poseFrame.base64!;

    try {
      const result = await poseScan.mutateAsync({ imageBase64: base64 });
      if (sessionRef.current !== session) return;

      if (!result.items || result.items.length === 0) {
        Alert.alert(
          'No clothing detected',
          'Try a full-body photo with better lighting, or add items manually.',
          [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
        );
        return;
      }

      await runExtraction(result.items, displayDataUrl, session);
    } catch (err: any) {
      if (sessionRef.current !== session) return;
      Alert.alert(
        'Scan failed',
        err?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
      );
    }
  };

  const runExtraction = async (
    poseItems: PoseScanItem[],
    fullImageDataUrl: string,
    session: number,
  ) => {
    const total = poseItems.length;
    setPhase('extracting');
    setExtractionProgress({ current: 0, total });
    setExtractedThumbs([]);

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
        setExtractionProgress({ current: completedCount, total });
        if (croppedImage) {
          setExtractedThumbs((prev) => [...prev, croppedImage]);
        }

        return { result, croppedImage, bbox: poseItem.bbox_pct ?? null };
      }),
    );

    if (sessionRef.current !== session) return;

    const extracted: EditableItem[] = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      const { result, croppedImage, bbox } = s.value;
      extracted.push({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: result.name || 'Unknown Item',
        brand: result.brand ?? null,
        category: result.category ?? null,
        subcategory: result.subcategory ?? null,
        color: result.color ?? null,
        style: result.style ?? null,
        seasons: result.seasons?.length ? result.seasons : [],
        occasions: result.occasions?.length ? result.occasions : [],
        material: result.material ?? null,
        fit: result.fit ?? null,
        pattern: result.pattern ?? null,
        neckline: result.neckline ?? null,
        care: result.care ?? null,
        formalityStyles: result.formalityStyles ?? [],
        notableDetails: result.notableDetails ?? [],
        colorPalette: result.colorPalette ?? [],
        colorNormalized: result.colorNormalized ?? null,
        colorTemperature: result.colorTemperature ?? null,
        warmthRating: result.warmthRating ?? null,
        croppedImage,
        expanded: false,
        sizeProfile: null,
        bbox: bbox ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } : null,
        sourceImage: fullImageDataUrl,
      });
    }

    if (extracted.length === 0) {
      Alert.alert(
        'Extraction failed',
        "Couldn't extract details for any items. Please try again.",
        [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
      );
      return;
    }

    setDetectedItems(extracted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('review');
  };

  const updateItem = useCallback((tempId: string, patch: Partial<EditableItem>) => {
    setDetectedItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)),
    );
  }, []);

  const removeItem = useCallback((tempId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetectedItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }, []);

  const handleAdjustCrop = useCallback((tempId: string) => {
    const item = detectedItems.find((it) => it.tempId === tempId);
    if (!item?.sourceImage || !item.bbox) return;
    setCropAdjustTarget({ tempId, sourceImage: item.sourceImage, bbox: item.bbox, itemName: item.name });
  }, [detectedItems]);

  const handleCropApply = useCallback(async (newBbox: Bbox) => {
    if (!cropAdjustTarget) return;
    const newCrop = await cropImage(cropAdjustTarget.sourceImage, newBbox, { maxDim: 800 });
    if (newCrop) {
      updateItem(cropAdjustTarget.tempId, { croppedImage: newCrop, bbox: newBbox });
    }
    setCropAdjustTarget(null);
  }, [cropAdjustTarget, updateItem]);

  const uploadImageToR2 = async (dataUrl: string): Promise<string> => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const ext = blob.type.includes('webp') ? 'webp' : 'jpg';
    const fileName = `users/${user!.id}/items/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { presignedUrl, publicUrl } = await api
      .post<{ presignedUrl: string; publicUrl: string }>('/api/upload-url', {
        fileName,
        fileType: blob.type,
      })
      .then((r) => r.data);

    await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': blob.type },
    });

    return publicUrl;
  };

  const handleSaveAll = async () => {
    if (detectedItems.length === 0) return;
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    const session = sessionRef.current;
    setPhase('saving');

    const savedItems: Item[] = [];

    for (const item of detectedItems) {
      // Progressive profiling: flag items whose enrichment fields are sparse so
      // the backend (and future UI prompts) know to ask for more details later.
      const enrichmentFields = [item.brand, item.material, item.fit, item.subcategory];
      const needsDetails = enrichmentFields.filter(Boolean).length === 0;

      let imageUrl: string | null = null;
      if (item.croppedImage) {
        try {
          imageUrl = await uploadImageToR2(item.croppedImage);
        } catch {
          // non-fatal: save item without image rather than aborting
        }
      }

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
              seasons: item.seasons.length > 0 ? item.seasons : [],
              occasions: item.occasions.length > 0 ? item.occasions : [],
              colorNormalized: item.colorNormalized ?? null,
              colorTemperature: item.colorTemperature ?? null,
              warmthRating: item.warmthRating ?? null,
              material: item.material || null,
              fit: item.fit || null,
              pattern: item.pattern || null,
              neckline: item.neckline || null,
              care: item.care || null,
              formalityStyles: item.formalityStyles.length > 0 ? item.formalityStyles : undefined,
              notableDetails: item.notableDetails.length > 0 ? item.notableDetails : undefined,
              colorPalette: item.colorPalette.length > 0 ? item.colorPalette : undefined,
              imageUrl,
              sizeProfile: item.sizeProfile ?? null,
              needsDetails,
            },
            { onSuccess: resolve, onError: reject },
          );
        });
        if (sessionRef.current !== session) return;
        savedItems.push(created);
      } catch {
        // individual failures are silently skipped
      }
    }

    if (sessionRef.current !== session) return;

    if (savedItems.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onItemsSaved?.(savedItems);
      onClose();
    } else {
      Alert.alert('Save failed', 'Could not save any items. Please try again.');
      setPhase('review');
    }
  };

  const headerTitle =
    phase === 'idle' ? 'Add to Wardrobe'
    : phase === 'scanning' ? 'Scanning outfit…'
    : phase === 'extracting' ? 'Extracting details…'
    : phase === 'saving' ? 'Adding to wardrobe…'
    : detectedItems.length === 1 ? '1 item detected'
    : `${detectedItems.length} items detected`;

  const canClose = phase === 'idle' || phase === 'review';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={canClose ? handleClose : undefined}
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
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
            {phase === 'idle' && <IdleContent onPickImage={pickImage} />}

            {(phase === 'scanning' || phase === 'extracting') && (
              <ScanProgress
                phase={phase}
                imageDataUrl={imageDataUrl}
                extractionProgress={extractionProgress}
                extractedThumbs={extractedThumbs}
              />
            )}

            {(phase === 'review' || phase === 'saving') && detectedItems.length > 0 && (
              <ReviewList
                items={detectedItems}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onAdjustCrop={handleAdjustCrop}
                disabled={phase === 'saving'}
              />
            )}
          </ScrollView>

          {/* Save footer */}
          {(phase === 'review' || phase === 'saving') && detectedItems.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveBtn, phase === 'saving' && styles.saveBtnBusy]}
                onPress={handleSaveAll}
                disabled={phase === 'saving'}
                activeOpacity={0.85}
              >
                {phase === 'saving' ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
                )}
                <Text style={styles.saveBtnText}>
                  {phase === 'saving'
                    ? 'Adding to wardrobe…'
                    : detectedItems.length === 1
                    ? 'Add to wardrobe'
                    : `Add all ${detectedItems.length} to wardrobe`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <CropAdjustModal
        visible={cropAdjustTarget !== null}
        sourceImage={cropAdjustTarget?.sourceImage ?? ''}
        initialBbox={cropAdjustTarget?.bbox ?? null}
        itemName={cropAdjustTarget?.itemName ?? ''}
        onApply={handleCropApply}
        onCancel={() => setCropAdjustTarget(null)}
      />
    </Modal>
  );
}

// ─── IdleContent ──────────────────────────────────────────────────────────────

function IdleContent({ onPickImage }: { onPickImage: (src: 'camera' | 'library') => void }) {
  return (
    <View style={idleStyles.container}>
      <Text style={idleStyles.subtitle}>
        Snap your outfit — AI detects every item you're wearing, including accessories.
      </Text>
      <TouchableOpacity style={idleStyles.option} onPress={() => onPickImage('camera')}>
        <View style={idleStyles.iconBox}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={idleStyles.optionText}>
          <Text style={idleStyles.optionTitle}>Take Photo</Text>
          <Text style={idleStyles.optionSub}>Snap your outfit or items</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
      <TouchableOpacity style={idleStyles.option} onPress={() => onPickImage('library')}>
        <View style={idleStyles.iconBox}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <View style={idleStyles.optionText}>
          <Text style={idleStyles.optionTitle}>Choose from Library</Text>
          <Text style={idleStyles.optionSub}>Select from camera roll</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const idleStyles = StyleSheet.create({
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
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
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

// ─── ScanProgress ─────────────────────────────────────────────────────────────

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

function ScanProgress({
  phase,
  imageDataUrl,
  extractionProgress,
  extractedThumbs,
}: {
  phase: 'scanning' | 'extracting';
  imageDataUrl: string | null;
  extractionProgress: { current: number; total: number };
  extractedThumbs: string[];
}) {
  const statusMsg = useCyclingScanStatus(phase === 'scanning');
  const progressNum =
    extractionProgress.total > 0
      ? Math.round((extractionProgress.current / extractionProgress.total) * 100)
      : 0;

  return (
    <View style={scanStyles.container}>
      {imageDataUrl && (
        <View style={scanStyles.previewBox}>
          <Image
            source={{ uri: imageDataUrl }}
            style={scanStyles.preview}
            resizeMode="cover"
          />
          <View style={scanStyles.previewDim} />
        </View>
      )}

      {phase === 'scanning' && (
        <View style={scanStyles.statusBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={scanStyles.statusTitle}>Detecting items…</Text>
          <Text style={scanStyles.statusSub}>{statusMsg}</Text>
          <View style={scanStyles.stepRow}>
            <View style={[scanStyles.stepDot, scanStyles.stepDotActive]} />
            <View style={scanStyles.stepLine} />
            <View style={scanStyles.stepDot} />
          </View>
          <View style={scanStyles.stepLabels}>
            <Text style={[scanStyles.stepLabel, scanStyles.stepLabelActive]}>Detect</Text>
            <Text style={scanStyles.stepLabel}>Extract</Text>
          </View>
        </View>
      )}

      {phase === 'extracting' && (
        <View style={scanStyles.statusBox}>
          {extractedThumbs.length > 0 ? (
            <View style={scanStyles.thumbRow}>
              {extractedThumbs.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={scanStyles.thumb} resizeMode="cover" />
              ))}
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}

          <View style={scanStyles.progressContainer}>
            <AnimatedProgressBar progress={progressNum} style={scanStyles.progressTrackFlex} />
            <Text style={scanStyles.progressText}>
              {extractionProgress.current} / {extractionProgress.total}
            </Text>
          </View>
          <Text style={scanStyles.statusSub}>
            {extractionProgress.current === 0
              ? 'Analysing items in parallel…'
              : extractionProgress.current < extractionProgress.total
              ? 'Extracting styling details…'
              : 'Wrapping up…'}
          </Text>

          <View style={scanStyles.stepRow}>
            <View style={[scanStyles.stepDot, scanStyles.stepDotDone]}>
              <Ionicons name="checkmark" size={10} color={colors.primaryForeground} />
            </View>
            <View style={[scanStyles.stepLine, scanStyles.stepLineDone]} />
            <View style={[scanStyles.stepDot, scanStyles.stepDotActive]} />
          </View>
          <View style={scanStyles.stepLabels}>
            <Text style={scanStyles.stepLabel}>Detect</Text>
            <Text style={[scanStyles.stepLabel, scanStyles.stepLabelActive]}>Extract</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const scanStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  previewBox: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    height: 160,
    backgroundColor: colors.muted,
  },
  preview: { width: '100%', height: '100%' },
  previewDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  statusBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  statusTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  statusSub: { fontSize: typography.size.sm, color: colors.mutedForeground },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 280,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    borderWidth: 2,
    borderColor: colors.border,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrackFlex: {
    flex: 1,
  },
  progressText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    minWidth: 32,
    textAlign: 'right',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: colors.primary, backgroundColor: colors.accent },
  stepDotDone: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepLine: { width: 40, height: 2, backgroundColor: colors.border, borderRadius: 1 },
  stepLineDone: { backgroundColor: colors.primary },
  stepLabels: {
    flexDirection: 'row',
    gap: spacing.sm + 40 + spacing.sm,
  },
  stepLabel: { fontSize: typography.size.xs, color: colors.mutedForeground },
  stepLabelActive: { color: colors.primary, fontWeight: typography.weight.semibold },
});

// ─── ReviewList ───────────────────────────────────────────────────────────────

function ReviewList({
  items,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
  disabled,
}: {
  items: EditableItem[];
  onUpdateItem: (id: string, patch: Partial<EditableItem>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustCrop: (id: string) => void;
  disabled: boolean;
}) {
  const brandSuggestions = useBrandSuggestions();

  return (
    <View style={reviewStyles.container}>
      {items.map((item, idx) => (
        <ItemCard
          key={item.tempId}
          item={item}
          index={idx}
          disabled={disabled}
          brandSuggestions={brandSuggestions}
          onUpdate={(patch) => onUpdateItem(item.tempId, patch)}
          onRemove={() => onRemoveItem(item.tempId)}
          onAdjustCrop={() => onAdjustCrop(item.tempId)}
        />
      ))}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
});

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  index,
  disabled,
  brandSuggestions,
  onUpdate,
  onRemove,
  onAdjustCrop,
}: {
  item: EditableItem;
  index: number;
  disabled: boolean;
  brandSuggestions: string[];
  onUpdate: (patch: Partial<EditableItem>) => void;
  onRemove: () => void;
  onAdjustCrop: () => void;
}) {
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onUpdate({ expanded: !item.expanded });
  };

  const categoryLabel = item.category
    ? (CATEGORY_LABELS[item.category as ItemCategory] ?? item.category)
    : null;

  const metaLine = [categoryLabel, item.subcategory, item.color].filter(Boolean).join(' · ');

  return (
    <View style={cardStyles.card}>
      {/* Collapsed row */}
      <View style={cardStyles.row}>
        {/* Thumbnail */}
        <View style={cardStyles.thumb}>
          {item.croppedImage ? (
            <Image source={{ uri: item.croppedImage }} style={cardStyles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
          )}
          {!disabled && item.sourceImage && item.bbox && (
            <TouchableOpacity
              style={cardStyles.cropBtn}
              onPress={onAdjustCrop}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel="Adjust crop"
            >
              <Ionicons name="crop-outline" size={11} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Info — tappable to toggle expand */}
        <TouchableOpacity style={cardStyles.info} onPress={toggleExpand} activeOpacity={0.7}>
          <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
          {metaLine.length > 0 && (
            <Text style={cardStyles.meta} numberOfLines={1}>{metaLine}</Text>
          )}
        </TouchableOpacity>

        {/* Actions */}
        <TouchableOpacity onPress={toggleExpand} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={item.expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRemove}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Expanded edit form */}
      {item.expanded && (
        <View style={cardStyles.editForm}>
          <Field label="Name">
            <TextInput
              style={cardStyles.input}
              value={item.name}
              onChangeText={(v) => onUpdate({ name: v })}
              autoCapitalize="words"
              editable={!disabled}
            />
          </Field>

          <Field label="Brand">
            <BrandAutocompleteInput
              value={item.brand ?? ''}
              onChangeText={(v) => onUpdate({ brand: v || null })}
              onSelect={(v) => onUpdate({ brand: v || null })}
              suggestions={brandSuggestions}
              placeholder="e.g. Uniqlo"
              style={disabled ? cardStyles.inputDisabled : undefined}
            />
          </Field>

          <Field label="Colour">
            <TextInput
              style={cardStyles.input}
              value={item.color ?? ''}
              onChangeText={(v) => onUpdate({ color: v || null })}
              autoCapitalize="words"
              placeholder="e.g. Navy Blue"
              placeholderTextColor={colors.mutedForeground}
              editable={!disabled}
            />
          </Field>

          <TaxonomySelector
            category={item.category ?? null}
            subcategory={item.subcategory ?? null}
            style={item.style ?? null}
            onCategoryChange={(v) => onUpdate({ category: v || null, subcategory: null, style: null })}
            onSubcategoryChange={(v) => onUpdate({ subcategory: v || null, style: null })}
            onStyleChange={(v) => onUpdate({ style: v || null })}
            disabled={disabled}
          />

          <View style={cardStyles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Field label="Season">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={cardStyles.pillRow}>
                    {SEASON_OPTIONS.map(({ label, value }) => {
                      const active = (item.seasons ?? []).includes(value);
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[cardStyles.pill, active && cardStyles.pillActive]}
                          onPress={() => {
                            const cur = item.seasons ?? [];
                            onUpdate({ seasons: active ? cur.filter((s) => s !== value) : [...cur, value] });
                          }}
                          disabled={disabled}
                        >
                          <Text style={[cardStyles.pillText, active && cardStyles.pillTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </Field>
            </View>
          </View>

          <View style={cardStyles.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="Fit">
                <TextInput
                  style={cardStyles.input}
                  value={item.fit ?? ''}
                  onChangeText={(v) => onUpdate({ fit: v || null })}
                  placeholder="e.g. Slim"
                  placeholderTextColor={colors.mutedForeground}
                  editable={!disabled}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Material">
                <TextInput
                  style={cardStyles.input}
                  value={item.material ?? ''}
                  onChangeText={(v) => onUpdate({ material: v || null })}
                  placeholder="e.g. Cotton"
                  placeholderTextColor={colors.mutedForeground}
                  editable={!disabled}
                />
              </Field>
            </View>
          </View>

          <SizeProfileInput
            category={item.category}
            subcategory={item.subcategory}
            style={item.style}
            formalityStyles={item.formalityStyles}
            value={item.sizeProfile}
            onChange={(p) => onUpdate({ sizeProfile: p })}
          />
        </View>
      )}
    </View>
  );
}

const SEASON_OPTIONS = [
  { label: 'Spring', value: 'spring' },
  { label: 'Summer', value: 'summer' },
  { label: 'Fall',   value: 'fall' },
  { label: 'Winter', value: 'winter' },
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  cropBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  name: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  meta: { fontSize: typography.size.sm, color: colors.mutedForeground },
  editForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  inputDisabled: { opacity: 0.5 },
  pillRow: { flexDirection: 'row', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  pillTextActive: { color: colors.primaryForeground },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  twoCol: { flexDirection: 'row', gap: spacing.md },
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
