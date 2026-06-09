import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCreateItem, useBrandSuggestions } from '../hooks/useItems';
import { colors, spacing, typography, radii } from '../theme';
import {
  type Item, type ItemCategory, type NormalizedColor, type Season, type Occasion,
} from '../types/item';
import { MenuContent } from './add-sheet/MenuContent';
import { ManualEntryForm } from './add-sheet/ManualEntryForm';

const WINDOW_HEIGHT = Dimensions.get('window').height;

// ─── Types ────────────────────────────────────────────────────────────────────

type View_ = 'menu' | 'manual' | 'saving';

export interface AddActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
  onTakePhoto?: () => void;
  onFromLibrary?: () => void;
  onBatchImport?: () => void;
  onLogOutfit?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddActionSheet({
  visible,
  onClose,
  onItemsSaved,
  onTakePhoto: onTakePhotoProp,
  onFromLibrary: onFromLibraryProp,
  onBatchImport: onBatchImportProp,
  onLogOutfit: onLogOutfitProp,
}: AddActionSheetProps) {
  const insets = useSafeAreaInsets();
  const createItem = useCreateItem();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const brandSuggestions = useBrandSuggestions();

  const [view, setView] = useState<View_>('menu');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<ItemCategory | null>(null);
  const [manualSubcategory, setManualSubcategory] = useState('');
  const [manualStyle, setManualStyle] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualColorNormalized, setManualColorNormalized] = useState<NormalizedColor | null>(null);
  const [manualSeasons, setManualSeasons] = useState<Season[]>([]);
  const [manualOccasions, setManualOccasions] = useState<Occasion[]>([]);
  const [manualBrand, setManualBrand] = useState('');
  const [manualImageDataUrl, setManualImageDataUrl] = useState<string | null>(null);

  const isManualView = view === 'manual' || view === 'saving';

  React.useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  // When switching to the manual form, snap to a tall fixed position so the
  // BottomSheetScrollView has a bounded height and all fields are reachable.
  React.useEffect(() => {
    if (isManualView) {
      const t = setTimeout(() => bottomSheetRef.current?.snapToIndex(0), 50);
      return () => clearTimeout(t);
    }
  }, [isManualView]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (view === 'saving') return;
    bottomSheetRef.current?.dismiss();
  }, [view]);

  const handleTakePhoto = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    setTimeout(() => onTakePhotoProp?.(), 300);
  }, [onTakePhotoProp]);

  const handleFromLibrary = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    setTimeout(() => onFromLibraryProp?.(), 300);
  }, [onFromLibraryProp]);

  const handleBatchImport = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    setTimeout(() => onBatchImportProp?.(), 300);
  }, [onBatchImportProp]);

  const handleLogOutfit = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    setTimeout(() => onLogOutfitProp?.(), 300);
  }, [onLogOutfitProp]);

  const handleSaveManual = useCallback(() => {
    if (!manualName.trim()) return;
    setView('saving');
    createItem.mutate(
      {
        name: manualName.trim(),
        brand: manualBrand.trim() || null,
        category: manualCategory,
        color: manualColor || null,
        colorNormalized: manualColorNormalized,
        subcategory: manualSubcategory || null,
        style: manualStyle || null,
        seasons: manualSeasons,
        occasions: manualOccasions,
        imageUrl: manualImageDataUrl || null,
      },
      {
        onSuccess: (created) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onItemsSaved?.([created]);
          bottomSheetRef.current?.dismiss();
        },
        onError: () => {
          Alert.alert('Save failed', 'Could not save item. Please try again.');
          setView('manual');
        },
      },
    );
  }, [manualName, manualBrand, manualCategory, manualColor, manualColorNormalized, manualSubcategory, manualStyle, manualSeasons, manualOccasions, manualImageDataUrl, createItem, onItemsSaved]);

  const canClose = view !== 'saving';

  const headerTitle =
    view === 'manual' ? 'Add Manually'
      : view === 'saving' ? 'Adding to wardrobe…'
        : 'Add to Styled';

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior={canClose ? 'close' : 'none'}
      />
    ),
    [canClose],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing={!isManualView}
      snapPoints={isManualView ? ['93%'] : undefined}
      maxDynamicContentSize={WINDOW_HEIGHT * 0.85}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose={canClose}
    >
      {/* ── Menu (dynamic sizing via BottomSheetView) ── */}
      {view === 'menu' && (
        <BottomSheetView style={styles.sheetContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add to Styled</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <MenuContent
            onTakePhoto={handleTakePhoto}
            onFromLibrary={handleFromLibrary}
            onBatchImport={handleBatchImport}
            onManual={() => setView('manual')}
            onLogOutfit={handleLogOutfit}
            bottomInset={insets.bottom}
          />
        </BottomSheetView>
      )}

      {/* ── Manual / Saving (fixed 93% snap, flex layout) ── */}
      {(view === 'manual' || view === 'saving') && (
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {view === 'manual' && (
                <TouchableOpacity
                  onPress={() => setView('menu')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ marginRight: spacing.sm }}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
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

          {/* Scrollable form body — flex: 1 fills space between header and footer */}
          <BottomSheetScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formScroll}
          >
            <ManualEntryForm
              name={manualName}
              category={manualCategory}
              subcategory={manualSubcategory}
              itemStyle={manualStyle}
              colorNormalized={manualColorNormalized}
              seasons={manualSeasons}
              occasions={manualOccasions}
              brand={manualBrand}
              brandSuggestions={brandSuggestions}
              imageDataUrl={manualImageDataUrl}
              disabled={view === 'saving'}
              onNameChange={setManualName}
              onCategoryChange={(v) => {
                setManualCategory(v);
                setManualSubcategory('');
                setManualStyle('');
              }}
              onSubcategoryChange={setManualSubcategory}
              onStyleChange={setManualStyle}
              onColorNormalizedChange={(color, displayName) => {
                setManualColorNormalized(color);
                setManualColor(displayName);
              }}
              onSeasonsChange={setManualSeasons}
              onOccasionsChange={setManualOccasions}
              onBrandChange={setManualBrand}
              onImageChange={setManualImageDataUrl}
            />
          </BottomSheetScrollView>

          {/* Footer — pinned at bottom */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.saveBtn, (view === 'saving' || !manualName.trim()) && styles.saveBtnDisabled]}
              onPress={handleSaveManual}
              disabled={view === 'saving' || !manualName.trim()}
              activeOpacity={0.85}
            >
              {view === 'saving' ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
              )}
              <Text style={styles.saveBtnText}>
                {view === 'saving' ? 'Adding to wardrobe…' : 'Add to wardrobe'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </BottomSheetModal>
  );
}

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.background,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },
  sheetContent: {
    flex: 1,
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
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  formScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
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
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
