import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { SizeProfileInput } from '../primitives/SizeProfileInput';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { CropAdjustEditor, type Bbox } from './CropAdjustModal';
import type { SizeProfile } from '../../lib/sizes';
import {
  filterBrandSuggestions,
  nextUnreviewedPieceId,
  resolvedActivePieceId,
  reviewCarouselIndex,
  reviewCarouselMetrics,
  reviewHeroHeight,
  scanReviewPrimaryAction,
  scanReviewPrimaryLabel,
} from '../../lib/scan-review';
import { colors, radii, spacing, typography } from '../../theme';
import { SEASON_LABELS, SEASON_OPTIONS, type SleeveLength } from '../../types/item';

export type ScanReviewStage = 'pre-extract' | 'extracting' | 'review' | 'saving';

export type ScanReviewPiece = {
  id: string;
  name: string;
  brand: string;
  photo: string | null;
  cutout: string | null;
  useCutout: boolean;
  canAdjustCrop: boolean;
  cropSource: string | null;
  cropBbox: Bbox | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  sizeProfile: SizeProfile | null;
  sleeveLength: SleeveLength | null;
};

type ExtractTrigger = 'completed_review' | 'extract_now';
type WorkspaceMode =
  | { kind: 'review' }
  | { kind: 'brand-search'; pieceId: string }
  | { kind: 'crop-editor'; pieceId: string }
  | { kind: 'confirm-remove'; pieceId: string }
  | { kind: 'confirm-close' };

type Props = {
  visible: boolean;
  stage: ScanReviewStage;
  pieces: ScanReviewPiece[];
  brandSuggestions: string[];
  extractionProgress: { current: number; total: number };
  failure?: { message: string; retryLabel?: string; onRetry: () => void } | null;
  onUpdate: (id: string, patch: Partial<ScanReviewPiece>) => void;
  onToggleCutout: (id: string) => void;
  onApplyCrop: (id: string, bbox: Bbox) => void;
  onRemove: (id: string) => void;
  onExtract: (trigger: ExtractTrigger, reviewedCount: number, brandCount: number) => void;
  onSave: () => void;
  onClose: () => void;
};

const SEASON_CHIPS = SEASON_OPTIONS.map((value) => ({ value, label: SEASON_LABELS[value] }));

function displayCount(count: number) {
  return count === 1 ? '1 piece' : `${count} pieces`;
}

export function ScanReviewWorkspace({
  visible,
  stage,
  pieces,
  brandSuggestions,
  extractionProgress,
  failure,
  onUpdate,
  onToggleCutout,
  onApplyCrop,
  onRemove,
  onExtract,
  onSave,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const carouselRef = useRef<FlatList<ScanReviewPiece>>(null);
  const detailsScrollRef = useRef<ScrollView>(null);
  const [activeId, setActiveId] = useState<string | null>(pieces[0]?.id ?? null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<WorkspaceMode>({ kind: 'review' });

  const metrics = useMemo(() => reviewCarouselMetrics(width), [width]);
  const isReviewStage = stage === 'review' || stage === 'saving';
  const heroHeight = reviewHeroHeight(height, isReviewStage);
  const pieceIds = useMemo(() => pieces.map((piece) => piece.id), [pieces]);
  const activeResolvedId = resolvedActivePieceId(pieceIds, activeId);
  const activeIndex = Math.max(0, pieceIds.indexOf(activeResolvedId ?? ''));
  const activePiece = pieces[activeIndex] ?? pieces[0] ?? null;
  const busy = stage === 'extracting' || stage === 'saving';
  const modePiece = mode.kind === 'brand-search' || mode.kind === 'crop-editor' || mode.kind === 'confirm-remove'
    ? pieces.find((piece) => piece.id === mode.pieceId) ?? null
    : null;

  useEffect(() => {
    if (activeResolvedId === activeId) return;
    setActiveId(activeResolvedId);
    const index = pieceIds.indexOf(activeResolvedId ?? '');
    if (index >= 0) carouselRef.current?.scrollToOffset({ offset: index * metrics.snapInterval, animated: false });
  }, [activeId, activeResolvedId, metrics.snapInterval, pieceIds]);

  useEffect(() => {
    setReviewedIds((current) => new Set([...current].filter((id) => pieceIds.includes(id))));
    setExpandedIds((current) => new Set([...current].filter((id) => pieceIds.includes(id))));
    if (modePiece && !pieceIds.includes(modePiece.id)) setMode({ kind: 'review' });
  }, [modePiece, pieceIds]);

  useEffect(() => {
    if (!visible || stage === 'extracting') setMode({ kind: 'review' });
  }, [stage, visible]);

  const scrollToPiece = useCallback((id: string, animated = true) => {
    const index = pieceIds.indexOf(id);
    if (index < 0) return;
    setActiveId(id);
    carouselRef.current?.scrollToOffset({
      offset: index * metrics.snapInterval,
      animated: reduceMotion ? false : animated,
    });
  }, [metrics.snapInterval, pieceIds, reduceMotion]);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (mode.kind !== 'review') {
      setMode({ kind: 'review' });
      return;
    }
    setMode({ kind: 'confirm-close' });
  }, [busy, mode.kind]);

  const extract = useCallback((trigger: ExtractTrigger, reviewed: Set<string>) => {
    const brandCount = pieces.filter((piece) => piece.brand.trim().length > 0).length;
    onExtract(trigger, reviewed.size, brandCount);
  }, [onExtract, pieces]);

  const handlePrimary = useCallback(() => {
    if (!activeResolvedId || stage !== 'pre-extract') return;
    const nextReviewed = new Set(reviewedIds);
    nextReviewed.add(activeResolvedId);
    setReviewedIds(nextReviewed);

    if (scanReviewPrimaryAction(pieceIds, reviewedIds, activeResolvedId) === 'extract') {
      extract('completed_review', nextReviewed);
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextId = nextUnreviewedPieceId(pieceIds, nextReviewed, activeResolvedId);
    if (nextId) scrollToPiece(nextId);
  }, [activeResolvedId, extract, pieceIds, reviewedIds, scrollToPiece, stage]);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = reviewCarouselIndex(event.nativeEvent.contentOffset.x, metrics.snapInterval, pieces.length);
    const piece = pieces[index];
    if (piece) setActiveId(piece.id);
  }, [metrics.snapInterval, pieces]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (mode.kind === 'crop-editor' && modePiece?.cropSource && modePiece.cropBbox) {
    return (
      <Modal visible={visible} presentationStyle="fullScreen" animationType="none" onRequestClose={requestClose}>
        <CropAdjustEditor
          sourceImage={modePiece.cropSource}
          initialBbox={modePiece.cropBbox}
          itemName={modePiece.name}
          onApply={(bbox) => {
            onApplyCrop(modePiece.id, bbox);
            setMode({ kind: 'review' });
          }}
          onCancel={() => setMode({ kind: 'review' })}
        />
      </Modal>
    );
  }

  if (mode.kind === 'brand-search' && modePiece) {
    return (
      <Modal visible={visible} presentationStyle="fullScreen" animationType="none" onRequestClose={requestClose}>
        <BrandSearch
          piece={modePiece}
          suggestions={brandSuggestions}
          onSelect={(brand) => {
            onUpdate(modePiece.id, { brand });
            setMode({ kind: 'review' });
          }}
          onCancel={() => setMode({ kind: 'review' })}
        />
      </Modal>
    );
  }

  const preExtractLabel = scanReviewPrimaryLabel(pieceIds, reviewedIds, activeResolvedId);
  const showExtractNow = stage === 'pre-extract'
    && scanReviewPrimaryAction(pieceIds, reviewedIds, activeResolvedId) === 'next';

  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WorkspaceHeader
          stage={stage}
          activeIndex={activeIndex}
          pieceCount={pieces.length}
          showCounter={!(isReviewStage && pieces.length > 1)}
          busy={busy}
          topInset={insets.top}
          onClose={requestClose}
        />

        {failure ? (
          <View style={styles.failureBanner} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.action} />
            <Text style={styles.failureText}>{failure.message}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={failure.onRetry} disabled={busy}>
              <Text style={styles.retryText}>{failure.retryLabel ?? 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {stage === 'extracting' ? (
          <ExtractionState piece={activePiece} progress={extractionProgress} heroHeight={heroHeight} />
        ) : (
          <ScrollView
            ref={detailsScrollRef}
            style={styles.mainScroll}
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            {stage === 'pre-extract' ? (
              <Text style={styles.guidance}>Check each piece and add a brand if you know it—it can improve accuracy.</Text>
            ) : null}

            <FlatList
              ref={carouselRef}
              data={pieces}
              keyExtractor={(item) => item.id}
              horizontal
              bounces={false}
              decelerationRate="fast"
              disableIntervalMomentum
              snapToInterval={metrics.snapInterval}
              snapToAlignment="start"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: metrics.sidePadding }}
              getItemLayout={(_, index) => ({ length: metrics.snapInterval, offset: metrics.snapInterval * index, index })}
              onMomentumScrollEnd={handleMomentumEnd}
              onScrollToIndexFailed={({ index }) => {
                carouselRef.current?.scrollToOffset({ offset: index * metrics.snapInterval, animated: false });
              }}
              renderItem={({ item }) => (
                <HeroCard
                  piece={item}
                  stage={stage}
                  width={metrics.cardWidth}
                  height={heroHeight}
                  gap={metrics.gap}
                  disabled={stage === 'saving'}
                  onToggleCutout={() => onToggleCutout(item.id)}
                  onAdjustCrop={() => setMode({ kind: 'crop-editor', pieceId: item.id })}
                  onOpenMenu={() => setMode({ kind: 'confirm-remove', pieceId: item.id })}
                />
              )}
            />

            {pieces.length > 1 ? (
              <Filmstrip
                pieces={pieces}
                stage={stage}
                activeId={activeResolvedId}
                reviewedIds={reviewedIds}
                disabled={busy}
                onSelect={scrollToPiece}
              />
            ) : null}

            {activePiece ? (
              <ActivePieceForm
                piece={activePiece}
                stage={stage}
                disabled={stage === 'saving'}
                detailsExpanded={expandedIds.has(activePiece.id)}
                onToggleDetails={() => toggleExpanded(activePiece.id)}
                onUpdate={(patch) => onUpdate(activePiece.id, patch)}
                onOpenBrand={() => setMode({ kind: 'brand-search', pieceId: activePiece.id })}
                onNameFocus={() => setTimeout(() => detailsScrollRef.current?.scrollToEnd({ animated: !reduceMotion }), 120)}
              />
            ) : null}
          </ScrollView>
        )}

        <WorkspaceFooter
          stage={stage}
          pieceCount={pieces.length}
          bottomInset={insets.bottom}
          preExtractLabel={preExtractLabel}
          showExtractNow={showExtractNow}
          onPrimary={handlePrimary}
          onExtractNow={() => extract('extract_now', reviewedIds)}
          onSave={onSave}
        />

        {mode.kind === 'confirm-remove' && modePiece ? (
          <ConfirmationPanel
            title="Remove this piece?"
            message={`${modePiece.name || 'This piece'} will be removed from this scan.`}
            confirmLabel="Remove piece"
            destructive
            bottomInset={insets.bottom}
            onCancel={() => setMode({ kind: 'review' })}
            onConfirm={() => {
              setMode({ kind: 'review' });
              onRemove(modePiece.id);
            }}
          />
        ) : mode.kind === 'confirm-close' ? (
          <ConfirmationPanel
            title="Discard this scan?"
            message="Your detected pieces and edits in this review will be removed."
            confirmLabel="Discard scan"
            destructive
            bottomInset={insets.bottom}
            onCancel={() => setMode({ kind: 'review' })}
            onConfirm={onClose}
          />
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WorkspaceHeader({ stage, activeIndex, pieceCount, showCounter, busy, topInset, onClose }: {
  stage: ScanReviewStage;
  activeIndex: number;
  pieceCount: number;
  showCounter: boolean;
  busy: boolean;
  topInset: number;
  onClose: () => void;
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.headerCopy}>
        <Text style={styles.title} numberOfLines={1}>
          {stage === 'review' || stage === 'saving' ? 'Review details' : 'Review your pieces'}
        </Text>
        {showCounter ? (
          <Text style={styles.counter} accessibilityLabel={`Piece ${activeIndex + 1} of ${pieceCount}`}>
            {activeIndex + 1} of {pieceCount}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={onClose}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Close closet scan"
      >
        <Ionicons name="close" size={24} color={busy ? colors.border : colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

function HeroCard({ piece, stage, width, height, gap, disabled, onToggleCutout, onAdjustCrop, onOpenMenu }: {
  piece: ScanReviewPiece;
  stage: ScanReviewStage;
  width: number;
  height: number;
  gap: number;
  disabled: boolean;
  onToggleCutout: () => void;
  onAdjustCrop: () => void;
  onOpenMenu: () => void;
}) {
  const canChooseCover = stage === 'review' || stage === 'saving';
  const showingCutout = canChooseCover && Boolean(piece.cutout && piece.useCutout);
  const imageUri = showingCutout ? piece.cutout : piece.photo;

  return (
    <View style={[styles.hero, { width, height, marginRight: gap }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.heroImage}
          contentFit="contain"
          contentPosition="center"
          cachePolicy="memory-disk"
          recyclingKey={`${piece.id}-${showingCutout ? 'cutout' : 'photo'}`}
          transition={150}
          accessibilityLabel={`Photo of ${piece.name}`}
        />
      ) : (
        <Ionicons name="shirt-outline" size={54} color={colors.mutedForeground} />
      )}

      <TouchableOpacity
        style={styles.overflowButton}
        onPress={onOpenMenu}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${piece.name}`}
      >
        <Ionicons name="ellipsis-horizontal" size={21} color={colors.foreground} />
      </TouchableOpacity>

      {canChooseCover && piece.cutout ? (
        <TouchableOpacity
          style={[styles.coverToggle, showingCutout && styles.coverToggleActive]}
          onPress={onToggleCutout}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: showingCutout }}
          accessibilityLabel={showingCutout ? 'Using cutout cover' : 'Using photo cover'}
        >
          <Ionicons name={showingCutout ? 'cut-outline' : 'image-outline'} size={14} color={showingCutout ? colors.primaryForeground : colors.foreground} />
          <Text style={[styles.coverToggleText, showingCutout && styles.coverToggleTextActive]}>
            {showingCutout ? 'Cutout' : 'Photo'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {piece.canAdjustCrop && piece.cropSource && piece.cropBbox ? (
        <TouchableOpacity
          style={styles.cropButton}
          onPress={onAdjustCrop}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Adjust crop for ${piece.name}`}
        >
          <Ionicons name="crop-outline" size={15} color={colors.foreground} />
          <Text style={styles.cropButtonText}>Adjust crop</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Filmstrip({ pieces, stage, activeId, reviewedIds, disabled, onSelect }: {
  pieces: ScanReviewPiece[];
  stage: ScanReviewStage;
  activeId: string | null;
  reviewedIds: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const canUseCutout = stage === 'review' || stage === 'saving';
  return (
    <View style={styles.filmstripFrame}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip} keyboardShouldPersistTaps="handled">
        {pieces.map((piece, index) => {
          const selected = piece.id === activeId;
          const reviewed = reviewedIds.has(piece.id);
          const showingCutout = canUseCutout && piece.useCutout && piece.cutout;
          const uri = showingCutout ? piece.cutout : piece.photo;
          return (
            <TouchableOpacity
              key={piece.id}
              style={[styles.filmstripThumb, selected && styles.filmstripThumbSelected]}
              onPress={() => onSelect(piece.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`View piece ${index + 1} of ${pieces.length}: ${piece.name}${reviewed ? ', reviewed' : ''}`}
              accessibilityState={{ selected }}
            >
              {uri ? <Image source={{ uri }} style={[styles.filmstripImage, !selected && styles.filmstripImageResting]} contentFit="contain" cachePolicy="memory-disk" recyclingKey={`filmstrip-${piece.id}`} /> : <Ionicons name="shirt-outline" size={24} color={colors.mutedForeground} />}
              {reviewed ? <View style={styles.reviewedBadge}><Ionicons name="checkmark" size={11} color={colors.white} /></View> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ActivePieceForm({ piece, stage, disabled, detailsExpanded, onToggleDetails, onUpdate, onOpenBrand, onNameFocus }: {
  piece: ScanReviewPiece;
  stage: ScanReviewStage;
  disabled: boolean;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  onUpdate: (patch: Partial<ScanReviewPiece>) => void;
  onOpenBrand: () => void;
  onNameFocus: () => void;
}) {
  const isReview = stage === 'review' || stage === 'saving';
  return (
    <View style={styles.formCard}>
      <Field label="Item name">
        <TextInput
          value={piece.name}
          onChangeText={(name) => onUpdate({ name })}
          onFocus={onNameFocus}
          editable={!disabled}
          autoCapitalize="words"
          style={styles.input}
          accessibilityLabel="Item name"
        />
      </Field>

      <Field label="Brand (optional)">
        <TouchableOpacity
          style={styles.brandRow}
          onPress={onOpenBrand}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={piece.brand ? `Brand, ${piece.brand}` : 'Choose a brand, optional'}
        >
          <Text style={[styles.brandValue, !piece.brand && styles.brandPlaceholder]} numberOfLines={1}>
            {piece.brand || 'Search or enter a brand'}
          </Text>
          <Ionicons name="search" size={19} color={colors.mutedForeground} />
        </TouchableOpacity>
        {stage === 'pre-extract' ? <Text style={styles.fieldHint}>Adding a brand can improve detail accuracy. Not sure? Leave it blank.</Text> : null}
      </Field>

      {isReview ? (
        <>
          {piece.category ? (
            <View style={styles.categorySummary}>
              <Text style={styles.categoryLabel}>Category</Text>
              <Text style={styles.categoryValue}>{piece.subcategory || piece.category}</Text>
            </View>
          ) : null}
          <View style={styles.twoColumnFields}>
            <View style={styles.flexField}><Field label="Colour"><TextInput value={piece.color ?? ''} onChangeText={(color) => onUpdate({ color: color || null })} editable={!disabled} placeholder="e.g. Navy" placeholderTextColor={colors.mutedForeground} style={styles.input} /></Field></View>
            <View style={styles.flexField}><Field label="Material"><TextInput value={piece.material ?? ''} onChangeText={(material) => onUpdate({ material: material || null })} editable={!disabled} placeholder="e.g. Cotton" placeholderTextColor={colors.mutedForeground} style={styles.input} /></Field></View>
          </View>
          <TouchableOpacity style={styles.moreDetailsButton} onPress={onToggleDetails} disabled={disabled} accessibilityRole="button" accessibilityState={{ expanded: detailsExpanded }}>
            <Text style={styles.moreDetailsText}>More details</Text>
            <Ionicons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
          </TouchableOpacity>
          {detailsExpanded ? <MoreDetails piece={piece} disabled={disabled} onUpdate={onUpdate} /> : null}
        </>
      ) : null}
    </View>
  );
}

function MoreDetails({ piece, disabled, onUpdate }: { piece: ScanReviewPiece; disabled: boolean; onUpdate: (patch: Partial<ScanReviewPiece>) => void }) {
  return (
    <View style={styles.detailsPanel}>
      <TaxonomySelector
        category={piece.category}
        subcategory={piece.subcategory}
        style={piece.style}
        onCategoryChange={(category) => onUpdate({ category: category || null, subcategory: null, style: null })}
        onSubcategoryChange={(subcategory) => onUpdate({ subcategory: subcategory || null, style: null })}
        onStyleChange={(style) => onUpdate({ style: style || null })}
        disabled={disabled}
      />
      <Field label="Season">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.pillRow}>
            {SEASON_CHIPS.map(({ value, label }) => {
              const selected = piece.seasons.includes(value);
              return (
                <TouchableOpacity key={value} style={[styles.pill, selected && styles.pillActive]} onPress={() => onUpdate({ seasons: selected ? piece.seasons.filter((season) => season !== value) : [...piece.seasons, value] })} disabled={disabled}>
                  <Text style={[styles.pillText, selected && styles.pillTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Field>
      <Field label="Fit"><TextInput value={piece.fit ?? ''} onChangeText={(fit) => onUpdate({ fit: fit || null })} editable={!disabled} placeholder="e.g. Relaxed" placeholderTextColor={colors.mutedForeground} style={styles.input} /></Field>
      <SizeProfileInput category={piece.category} subcategory={piece.subcategory} style={piece.style} formalityValues={piece.occasions} value={piece.sizeProfile} onChange={(sizeProfile) => onUpdate({ sizeProfile })} />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function BrandSearch({ piece, suggestions, onSelect, onCancel }: {
  piece: ScanReviewPiece;
  suggestions: string[];
  onSelect: (brand: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(piece.brand);
  const filtered = useMemo(() => filterBrandSuggestions(suggestions, query), [query, suggestions]);
  const trimmed = query.trim();
  const exactMatch = suggestions.some((brand) => brand.toLocaleLowerCase() === trimmed.toLocaleLowerCase());

  return (
    <KeyboardAvoidingView style={styles.brandSearchRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.brandSearchHeader, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.headerButton} onPress={onCancel} accessibilityLabel="Back to piece review"><Ionicons name="chevron-back" size={24} color={colors.foreground} /></TouchableOpacity>
        <View style={styles.brandSearchTitleWrap}><Text style={styles.title}>Choose a brand</Text><Text style={styles.counter} numberOfLines={1}>{piece.name}</Text></View>
        <View style={styles.headerButton} />
      </View>
      <View style={styles.brandSearchInputWrap}>
        <Ionicons name="search" size={20} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search or enter a brand"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => { if (trimmed) onSelect(trimmed); }}
          style={styles.brandSearchInput}
          accessibilityLabel="Search brands"
        />
        {query ? <TouchableOpacity style={styles.clearSearchButton} onPress={() => setQuery('')} accessibilityLabel="Clear brand search"><Ionicons name="close-circle" size={20} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(brand) => brand.toLocaleLowerCase()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.brandResults, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <>
            {trimmed && !exactMatch ? <BrandResult icon="add" label={`Use “${trimmed}”`} onPress={() => onSelect(trimmed)} /> : null}
            <BrandResult icon="close-circle-outline" label="No brand" muted onPress={() => onSelect('')} />
            <Text style={styles.brandResultsLabel}>{trimmed ? 'Matching brands' : 'Suggested brands'}</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyBrands}>No matching brands. You can still use the name you typed.</Text>}
        renderItem={({ item }) => <BrandResult icon="pricetag-outline" label={item} onPress={() => onSelect(item)} />}
      />
    </KeyboardAvoidingView>
  );
}

function BrandResult({ icon, label, muted, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; muted?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.brandResult} onPress={onPress} accessibilityRole="button">
      <View style={styles.brandResultIcon}><Ionicons name={icon} size={19} color={muted ? colors.mutedForeground : colors.primary} /></View>
      <Text style={[styles.brandResultText, muted && styles.brandResultMuted]} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.border} />
    </TouchableOpacity>
  );
}

function ConfirmationPanel({ title, message, confirmLabel, destructive, bottomInset, onCancel, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  bottomInset: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.confirmationLayer} accessibilityViewIsModal>
      <TouchableOpacity style={styles.confirmationBackdrop} activeOpacity={1} onPress={onCancel} accessibilityLabel="Cancel" />
      <View style={[styles.confirmationCard, { paddingBottom: Math.max(bottomInset, spacing.lg) }]}>
        <View style={styles.confirmationHandle} />
        <Text style={styles.confirmationTitle}>{title}</Text>
        <Text style={styles.confirmationMessage}>{message}</Text>
        <TouchableOpacity style={[styles.confirmButton, destructive && styles.destructiveButton]} onPress={onConfirm} accessibilityRole="button">
          <Text style={[styles.confirmButtonText, destructive && styles.destructiveButtonText]}>{confirmLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmCancelButton} onPress={onCancel} accessibilityRole="button"><Text style={styles.confirmCancelText}>Keep reviewing</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function WorkspaceFooter({ stage, pieceCount, bottomInset, preExtractLabel, showExtractNow, onPrimary, onExtractNow, onSave }: {
  stage: ScanReviewStage;
  pieceCount: number;
  bottomInset: number;
  preExtractLabel: string;
  showExtractNow: boolean;
  onPrimary: () => void;
  onExtractNow: () => void;
  onSave: () => void;
}) {
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      {stage === 'pre-extract' ? (
        <>
          <TouchableOpacity style={styles.primaryButton} onPress={onPrimary} accessibilityRole="button"><Ionicons name="sparkles" size={19} color={colors.primaryForeground} /><Text style={styles.primaryButtonText}>{preExtractLabel}</Text></TouchableOpacity>
          {showExtractNow ? <TouchableOpacity style={styles.secondaryButton} onPress={onExtractNow} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Extract now</Text></TouchableOpacity> : null}
        </>
      ) : stage === 'review' || stage === 'saving' ? (
        <TouchableOpacity style={[styles.primaryButton, stage === 'saving' && styles.primaryButtonDisabled]} onPress={onSave} disabled={stage === 'saving'} accessibilityRole="button">
          {stage === 'saving' ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />}
          <Text style={styles.primaryButtonText}>{stage === 'saving' ? 'Adding to closet…' : pieceCount === 1 ? 'Add to closet' : `Add all ${pieceCount} to closet`}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.extractingFooter}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.extractingFooterText}>Extracting details for {displayCount(pieceCount)}…</Text></View>
      )}
    </View>
  );
}

function ExtractionState({ piece, progress, heroHeight }: { piece: ScanReviewPiece | null; progress: { current: number; total: number }; heroHeight: number }) {
  const uri = piece?.photo;
  const fraction = progress.total > 0 ? progress.current / progress.total : 0;
  return (
    <View style={styles.extractionState} accessibilityLiveRegion="polite">
      <View style={[styles.extractionHero, { height: heroHeight }]}>{uri ? <Image source={{ uri }} style={styles.heroImage} contentFit="contain" cachePolicy="memory-disk" /> : null}</View>
      <Text style={styles.extractionTitle}>Refining your pieces</Text>
      <Text style={styles.extractionCopy}>Adding colour, material, fit, and styling details.</Text>
      <View style={styles.progressRow}><View style={styles.progressBar}><AnimatedProgressBar progress={fraction} /></View><Text style={styles.progressCount}>{progress.current}/{progress.total}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  headerCopy: { flex: 1, alignItems: 'center', gap: 1, paddingLeft: 44 },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  counter: { ...typography.text.caption, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  failureBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surfaceSelected },
  failureText: { ...typography.text.bodySmall, color: colors.inkSubtle, flex: 1 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  retryText: { ...typography.text.label, color: colors.action },
  mainScroll: { flex: 1 },
  mainContent: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.sm },
  guidance: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.xl },
  hero: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderRadius: radii.xl, borderCurve: 'continuous', boxShadow: '0 6px 20px rgba(61,48,38,0.08)' },
  heroImage: { width: '100%', height: '100%' },
  overflowButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,252,247,0.94)' },
  coverToggle: { position: 'absolute', top: spacing.md, left: spacing.md, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: 'rgba(255,252,247,0.94)' },
  coverToggleActive: { backgroundColor: colors.primary },
  coverToggleText: { ...typography.text.caption, fontWeight: typography.weight.semibold, color: colors.foreground },
  coverToggleTextActive: { color: colors.primaryForeground },
  cropButton: { position: 'absolute', bottom: spacing.md, right: spacing.md, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: 'rgba(255,252,247,0.94)' },
  cropButtonText: { ...typography.text.caption, fontWeight: typography.weight.semibold, color: colors.foreground },
  filmstripFrame: { height: 110, flexShrink: 0, justifyContent: 'center' },
  filmstrip: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  // Selected reads as a lifted primary ring; reviewed reads as a green tick in
  // the opposite corner — the two states must never be confusable.
  filmstripThumb: { width: 68, height: 86, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  filmstripThumbSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surfaceElevated, boxShadow: '0 4px 12px rgba(61,48,38,0.16)' },
  filmstripImage: { width: '100%', height: '100%', borderRadius: radii.md - 1 },
  filmstripImageResting: { opacity: 0.78 },
  reviewedBadge: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderWidth: 2, borderColor: colors.background },
  formCard: { gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radii.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  fieldHint: { ...typography.text.caption, color: colors.mutedForeground },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: typography.text.body.fontSize, color: colors.foreground, backgroundColor: colors.background },
  brandRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.background },
  brandValue: { ...typography.text.body, color: colors.foreground, flex: 1 },
  brandPlaceholder: { color: colors.mutedForeground },
  categorySummary: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  categoryLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  categoryValue: { ...typography.text.bodySmall, color: colors.foreground, flex: 1, textAlign: 'right' },
  twoColumnFields: { flexDirection: 'row', gap: spacing.md },
  flexField: { flex: 1 },
  moreDetailsButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  moreDetailsText: { ...typography.text.label, color: colors.primary },
  detailsPanel: { gap: spacing.lg, paddingTop: spacing.xs },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.secondary },
  pillActive: { backgroundColor: colors.primary },
  pillText: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.foreground },
  pillTextActive: { color: colors.primaryForeground },
  footer: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.background },
  primaryButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.primary },
  primaryButtonDisabled: { opacity: 0.72 },
  primaryButtonText: { ...typography.text.sectionTitle, color: colors.primaryForeground },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { ...typography.text.label, color: colors.action },
  extractingFooter: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  extractingFooterText: { ...typography.text.bodySmall, color: colors.mutedForeground },
  extractionState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  extractionHero: { width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.card },
  extractionTitle: { ...typography.text.editorialSection, color: colors.foreground },
  extractionCopy: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center' },
  progressRow: { width: '100%', maxWidth: 300, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressBar: { flex: 1 },
  progressCount: { ...typography.text.caption, color: colors.mutedForeground, minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  brandSearchRoot: { flex: 1, backgroundColor: colors.background },
  brandSearchHeader: { minHeight: 84, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  brandSearchTitleWrap: { flex: 1, alignItems: 'center', gap: 1 },
  brandSearchInputWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  brandSearchInput: { flex: 1, minHeight: 50, ...typography.text.body, color: colors.foreground },
  clearSearchButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brandResults: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  brandResultsLabel: { ...typography.text.eyebrow, color: colors.mutedForeground, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  brandResult: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  brandResultIcon: { width: 32, height: 32, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  brandResultText: { ...typography.text.body, color: colors.foreground, flex: 1 },
  brandResultMuted: { color: colors.mutedForeground },
  emptyBrands: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', padding: spacing.xl },
  confirmationLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', zIndex: 100 },
  confirmationBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(31,26,22,0.36)' },
  confirmationCard: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.background, boxShadow: '0 -8px 28px rgba(31,26,22,0.12)' },
  confirmationHandle: { width: 38, height: 4, alignSelf: 'center', borderRadius: radii.full, backgroundColor: colors.border },
  confirmationTitle: { ...typography.text.editorialSection, color: colors.foreground, textAlign: 'center' },
  confirmationMessage: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center' },
  confirmButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radii.xl, backgroundColor: colors.primary },
  destructiveButton: { backgroundColor: colors.surfaceSelected, borderWidth: 1, borderColor: colors.action },
  confirmButtonText: { ...typography.text.label, color: colors.primaryForeground },
  destructiveButtonText: { color: colors.action },
  confirmCancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { ...typography.text.label, color: colors.foreground },
});
