import React, { useState, useRef, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { compressImageToDataUrl } from '../../lib/compressImage';
import {
  scanVisionPoseDirect,
  scanItemDirect,
  useCreateItem,
  useBrandSuggestions,
  type PoseScanItem,
} from '../../hooks/useItems';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, type Item, type ItemCategory } from '../../types/item';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { SizeProfileInput } from '../primitives/SizeProfileInput';
import type { SizeProfile } from '../../lib/sizes';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_PHOTOS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'processing' | 'review' | 'saving';

type PhotoStatus = 'pending' | 'scanning' | 'extracting' | 'done' | 'error';

type PhotoJob = {
  id: string;
  thumbDataUrl: string;
  status: PhotoStatus;
  itemCount: number;
  errorMsg: string | null;
};

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
  croppedImage: string | null;
  expanded: boolean;
  sizeProfile: SizeProfile | null;
};

interface BatchScanSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BatchScanSheet({ visible, onClose, onItemsSaved }: BatchScanSheetProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [photoJobs, setPhotoJobs] = useState<PhotoJob[]>([]);
  const [allItems, setAllItems] = useState<EditableItem[]>([]);
  const sessionRef = useRef(0);

  const createItem = useCreateItem();

  const reset = useCallback(() => {
    sessionRef.current += 1;
    setPhase('idle');
    setPhotoJobs([]);
    setAllItems([]);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === 'processing' || phase === 'saving') return;
    onClose();
  }, [phase, onClose]);

  // Reset when hidden
  React.useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  const pickPhotos = async () => {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (status === 'denied') {
      showLibraryDeniedAlert();
      return;
    }
    if (status !== 'granted') {
      const { status: req } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (req !== 'granted') {
        showLibraryDeniedAlert();
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: MAX_PHOTOS,
    });

    if (result.canceled || !result.assets.length) return;

    await processPhotos(result.assets);
  };

  const processPhotos = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const session = sessionRef.current;

    const jobs: PhotoJob[] = assets.map((_, i) => ({
      id: `photo-${Date.now()}-${i}`,
      thumbDataUrl: '',
      status: 'pending',
      itemCount: 0,
      errorMsg: null,
    }));

    setPhotoJobs(jobs);
    setPhase('processing');

    const accumulatedItems: EditableItem[] = [];

    for (let i = 0; i < assets.length; i++) {
      if (sessionRef.current !== session) return;

      const asset = assets[i];
      const jobId = jobs[i].id;

      // Compress photo
      let compressed: { uri: string; dataUrl: string };
      try {
        compressed = await compressImageToDataUrl(
          { uri: asset.uri, width: asset.width ?? 1024, height: asset.height ?? 1024 },
          1024,
          0.8,
        );
      } catch {
        updateJob(jobId, { thumbDataUrl: asset.uri, status: 'error', errorMsg: 'Compression failed' });
        continue;
      }

      updateJob(jobId, { thumbDataUrl: compressed.dataUrl, status: 'scanning' });

      // Pose scan
      let poseItems: PoseScanItem[] = [];
      try {
        const base64 = compressed.dataUrl.includes(',')
          ? compressed.dataUrl.split(',')[1]
          : compressed.dataUrl;
        const poseResult = await scanVisionPoseDirect(base64);
        poseItems = poseResult.items ?? [];
      } catch {
        updateJob(jobId, { status: 'error', errorMsg: 'Scan failed — service may be unavailable' });
        continue;
      }

      if (sessionRef.current !== session) return;

      if (poseItems.length === 0) {
        updateJob(jobId, { status: 'done', itemCount: 0 });
        continue;
      }

      updateJob(jobId, { status: 'extracting' });

      // Extract item details in parallel
      const settled = await Promise.allSettled(
        poseItems.map(async (poseItem) => {
          const croppedImage = poseItem.croppedWebP
            ? `data:image/webp;base64,${poseItem.croppedWebP}`
            : null;
          const imageData = croppedImage ?? compressed.dataUrl;
          const otherItems = poseItems
            .filter((p) => p !== poseItem)
            .map((p) => `${p.name} (${p.category})`)
            .join(', ');

          const result = await scanItemDirect({ imageData, outfitContext: otherItems || undefined });
          return { result, croppedImage };
        }),
      );

      if (sessionRef.current !== session) return;

      const extracted: EditableItem[] = [];
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        const { result, croppedImage } = s.value;
        extracted.push({
          tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: result.name || 'Unknown Item',
          brand: result.brand ?? null,
          category: result.category ?? null,
          subcategory: result.subcategory ?? null,
          color: result.color ?? null,
          style: result.style ?? null,
          seasons: result.seasons ?? [],
          occasions: result.occasions ?? [],
          material: result.material ?? null,
          fit: result.fit ?? null,
          pattern: result.pattern ?? null,
          neckline: result.neckline ?? null,
          care: result.care ?? null,
          formalityStyles: result.formalityStyles ?? [],
          notableDetails: result.notableDetails ?? [],
          colorPalette: result.colorPalette ?? [],
          croppedImage,
          expanded: false,
          sizeProfile: null,
        });
      }

      accumulatedItems.push(...extracted);
      updateJob(jobId, { status: 'done', itemCount: extracted.length });
    }

    if (sessionRef.current !== session) return;

    if (accumulatedItems.length === 0) {
      Alert.alert(
        'Nothing detected',
        'No clothing items were found in the selected photos. Try photos with better lighting or clearer clothing.',
        [{ text: 'OK', onPress: reset }],
      );
      return;
    }

    setAllItems(accumulatedItems);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('review');
  };

  const updateJob = (id: string, patch: Partial<PhotoJob>) => {
    setPhotoJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const updateItem = useCallback((tempId: string, patch: Partial<EditableItem>) => {
    setAllItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((tempId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAllItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }, []);

  const handleSaveAll = async () => {
    if (allItems.length === 0) return;
    const session = sessionRef.current;
    setPhase('saving');

    const savedItems: Item[] = [];

    for (const item of allItems) {
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
              seasons: item.seasons ?? [],
              occasions: item.occasions ?? [],
              material: item.material || null,
              fit: item.fit || null,
              pattern: item.pattern || null,
              neckline: item.neckline || null,
              care: item.care || null,
              formalityStyles: item.formalityStyles.length > 0 ? item.formalityStyles : undefined,
              notableDetails: item.notableDetails.length > 0 ? item.notableDetails : undefined,
              colorPalette: item.colorPalette.length > 0 ? item.colorPalette : undefined,
              imageUrl: item.croppedImage,
              sizeProfile: item.sizeProfile ?? null,
            },
            { onSuccess: resolve, onError: reject },
          );
        });
        if (sessionRef.current !== session) return;
        savedItems.push(created);
      } catch {
        // individual save failures are silently skipped
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

  const doneCount = photoJobs.filter((j) => j.status === 'done' || j.status === 'error').length;
  const totalCount = photoJobs.length;
  const errorCount = photoJobs.filter((j) => j.status === 'error').length;

  const headerTitle =
    phase === 'idle' ? 'Batch Scan'
    : phase === 'processing' ? `Scanning ${doneCount}/${totalCount} photos…`
    : phase === 'saving' ? 'Adding to wardrobe…'
    : allItems.length === 1 ? '1 item detected'
    : `${allItems.length} items detected`;

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
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="images-outline" size={18} color={colors.primary} />
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
            {phase === 'idle' && <IdleContent onPickPhotos={pickPhotos} />}

            {phase === 'processing' && (
              <ProcessingContent
                jobs={photoJobs}
                doneCount={doneCount}
                totalCount={totalCount}
                errorCount={errorCount}
              />
            )}

            {(phase === 'review' || phase === 'saving') && allItems.length > 0 && (
              <ReviewContent
                items={allItems}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                disabled={phase === 'saving'}
              />
            )}
          </ScrollView>

          {/* Footer */}
          {(phase === 'review' || phase === 'saving') && allItems.length > 0 && (
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
                    : allItems.length === 1
                    ? 'Add to wardrobe'
                    : `Add all ${allItems.length} to wardrobe`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── IdleContent ──────────────────────────────────────────────────────────────

function IdleContent({ onPickPhotos }: { onPickPhotos: () => void }) {
  return (
    <View style={idleStyles.container}>
      <Text style={idleStyles.subtitle}>
        Select up to {MAX_PHOTOS} photos from your library. AI will detect and extract every clothing item across all photos.
      </Text>
      <TouchableOpacity style={idleStyles.pickBtn} onPress={onPickPhotos} activeOpacity={0.85}>
        <Ionicons name="images-outline" size={22} color={colors.primaryForeground} />
        <Text style={idleStyles.pickBtnText}>Select Photos</Text>
      </TouchableOpacity>
      <Text style={idleStyles.hint}>
        Tip: use outfit photos or flat-lays for best results.
      </Text>
    </View>
  );
}

const idleStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.6,
    textAlign: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pickBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

// ─── ProcessingContent ────────────────────────────────────────────────────────

function ProcessingContent({
  jobs,
  doneCount,
  totalCount,
  errorCount,
}: {
  jobs: PhotoJob[];
  doneCount: number;
  totalCount: number;
  errorCount: number;
}) {
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <View style={procStyles.container}>
      {/* Overall progress bar */}
      <View style={procStyles.progressSection}>
        <AnimatedProgressBar progress={progressPct} />
        <Text style={procStyles.progressLabel}>
          {doneCount} of {totalCount} photos
          {errorCount > 0 ? ` · ${errorCount} failed` : ''}
        </Text>
      </View>

      {/* Per-photo grid */}
      <View style={procStyles.photoGrid}>
        {jobs.map((job) => (
          <PhotoJobCard key={job.id} job={job} />
        ))}
      </View>
    </View>
  );
}

function PhotoJobCard({ job }: { job: PhotoJob }) {
  const statusIcon: Record<PhotoStatus, string> = {
    pending: 'ellipse-outline',
    scanning: 'search-outline',
    extracting: 'color-wand-outline',
    done: 'checkmark-circle',
    error: 'alert-circle',
  };
  const statusColor: Record<PhotoStatus, string> = {
    pending: colors.mutedForeground,
    scanning: colors.primary,
    extracting: colors.primary,
    done: colors.primary,
    error: colors.error,
  };
  const statusLabel: Record<PhotoStatus, string> = {
    pending: 'Waiting…',
    scanning: 'Scanning…',
    extracting: 'Extracting…',
    done: job.itemCount === 0 ? 'No items' : `${job.itemCount} item${job.itemCount === 1 ? '' : 's'}`,
    error: job.errorMsg ?? 'Failed',
  };

  return (
    <View style={procStyles.photoCard}>
      {job.thumbDataUrl ? (
        <Image source={{ uri: job.thumbDataUrl }} style={procStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={[procStyles.thumb, procStyles.thumbPlaceholder]}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        </View>
      )}
      <View style={procStyles.photoStatus}>
        {job.status === 'scanning' || job.status === 'extracting' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={statusIcon[job.status] as any}
            size={16}
            color={statusColor[job.status]}
          />
        )}
        <Text style={[procStyles.statusText, { color: statusColor[job.status] }]} numberOfLines={1}>
          {statusLabel[job.status]}
        </Text>
      </View>
    </View>
  );
}

const procStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  progressSection: { gap: spacing.xs },
  progressLabel: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'right',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCard: {
    width: '30%',
    gap: spacing.xs,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: typography.size.xs,
    flex: 1,
  },
});

// ─── ReviewContent ────────────────────────────────────────────────────────────

function ReviewContent({
  items,
  onUpdateItem,
  onRemoveItem,
  disabled,
}: {
  items: EditableItem[];
  onUpdateItem: (id: string, patch: Partial<EditableItem>) => void;
  onRemoveItem: (id: string) => void;
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
        />
      ))}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
});

// ─── ItemCard ─────────────────────────────────────────────────────────────────

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

function ItemCard({
  item,
  index,
  disabled,
  brandSuggestions,
  onUpdate,
  onRemove,
}: {
  item: EditableItem;
  index: number;
  disabled: boolean;
  brandSuggestions: string[];
  onUpdate: (patch: Partial<EditableItem>) => void;
  onRemove: () => void;
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
      <View style={cardStyles.row}>
        <View style={cardStyles.thumb}>
          {item.croppedImage ? (
            <Image source={{ uri: item.croppedImage }} style={cardStyles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
          )}
        </View>

        <TouchableOpacity style={cardStyles.info} onPress={toggleExpand} activeOpacity={0.7}>
          <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
          {metaLine.length > 0 && (
            <Text style={cardStyles.meta} numberOfLines={1}>{metaLine}</Text>
          )}
        </TouchableOpacity>

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
  twoCol: { flexDirection: 'row', gap: spacing.md },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showLibraryDeniedAlert() {
  Alert.alert(
    'Photo library access needed',
    'Styled needs photo library access to batch scan items. Enable it in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ],
  );
}

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
    maxHeight: '92%',
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
