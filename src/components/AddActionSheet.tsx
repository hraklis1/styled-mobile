import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  Image,
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
import { useCameraLaunch, useLibraryLaunch } from '../hooks/useCameraLaunch';
import { colors, spacing, typography, radii } from '../theme';
import {
  CATEGORY_LABELS, CATEGORY_ORDER, NORMALIZED_COLORS,
  SEASON_OPTIONS, SEASON_LABELS, OCCASION_OPTIONS, OCCASION_LABELS,
  type Item, type ItemCategory, type NormalizedColor, type Season, type Occasion,
} from '../types/item';
import { NORMALIZED_COLOR_HEX, isColorLight, normalizedColorDisplayName } from '../lib/colorUtils';
import { TaxonomySelector } from './primitives/TaxonomySelector';
import { BrandAutocompleteInput } from './primitives/BrandAutocompleteInput';

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
            <ManualForm
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

// ─── MenuContent ──────────────────────────────────────────────────────────────

function MenuContent({
  onTakePhoto,
  onFromLibrary,
  onBatchImport,
  onManual,
  onLogOutfit,
  bottomInset,
}: {
  onTakePhoto: () => void;
  onFromLibrary: () => void;
  onBatchImport: () => void;
  onManual: () => void;
  onLogOutfit: () => void;
  bottomInset: number;
}) {
  return (
    <View style={[menuStyles.container, { paddingBottom: Math.max(bottomInset, spacing.xl) }]}>
      <Text style={menuStyles.sectionLabel}>Add to Wardrobe</Text>

      <TouchableOpacity style={menuStyles.option} onPress={onTakePhoto} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>Take Photo</Text>
          <Text style={menuStyles.optionSub}>Snap your item — AI fills in the details</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={menuStyles.option} onPress={onFromLibrary} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>From Library</Text>
          <Text style={menuStyles.optionSub}>Pick from your camera roll</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={menuStyles.option} onPress={onBatchImport} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="images-outline" size={22} color={colors.primary} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>Batch Import</Text>
          <Text style={menuStyles.optionSub}>Scan up to 10 photos at once</Text>
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

      <View style={menuStyles.divider} />
      <Text style={menuStyles.sectionLabel}>Log</Text>

      <TouchableOpacity style={menuStyles.option} onPress={onLogOutfit} activeOpacity={0.75}>
        <View style={[menuStyles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="layers-outline" size={22} color={colors.primary} />
        </View>
        <View style={menuStyles.optionText}>
          <Text style={menuStyles.optionTitle}>Log an Outfit</Text>
          <Text style={menuStyles.optionSub}>Record what you wore today</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const menuStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: -spacing.xs,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.xs,
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

// ─── ManualForm ───────────────────────────────────────────────────────────────

function ManualForm({
  name,
  category,
  subcategory,
  itemStyle,
  colorNormalized,
  seasons,
  occasions,
  brand,
  brandSuggestions,
  imageDataUrl,
  disabled,
  onNameChange,
  onCategoryChange,
  onSubcategoryChange,
  onStyleChange,
  onColorNormalizedChange,
  onSeasonsChange,
  onOccasionsChange,
  onBrandChange,
  onImageChange,
}: {
  name: string;
  category: ItemCategory | null;
  subcategory: string;
  itemStyle: string;
  colorNormalized: NormalizedColor | null;
  seasons: Season[];
  occasions: Occasion[];
  brand: string;
  brandSuggestions: string[];
  imageDataUrl: string | null;
  disabled: boolean;
  onNameChange: (v: string) => void;
  onCategoryChange: (v: ItemCategory | null) => void;
  onSubcategoryChange: (v: string) => void;
  onStyleChange: (v: string) => void;
  onColorNormalizedChange: (color: NormalizedColor, displayName: string) => void;
  onSeasonsChange: (v: Season[]) => void;
  onOccasionsChange: (v: Occasion[]) => void;
  onBrandChange: (v: string) => void;
  onImageChange: (dataUrl: string | null) => void;
}) {
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();

  const handlePickPhoto = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) {
            const img = await launchCamera({ maxDim: 800, allowsEditing: true });
            if (img) onImageChange(img.dataUrl);
          } else if (idx === 2) {
            const img = await launchLibrary({ maxDim: 800, allowsEditing: true });
            if (img) onImageChange(img.dataUrl);
          }
        },
      );
    } else {
      Alert.alert('Add Photo', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: async () => {
            const img = await launchCamera({ maxDim: 800, allowsEditing: true });
            if (img) onImageChange(img.dataUrl);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const img = await launchLibrary({ maxDim: 800, allowsEditing: true });
            if (img) onImageChange(img.dataUrl);
          },
        },
      ]);
    }
  }, [launchCamera, launchLibrary, onImageChange]);

  const toggleSeason = useCallback(
    (s: Season) => onSeasonsChange(
      seasons.includes(s) ? seasons.filter((x) => x !== s) : [...seasons, s]
    ),
    [seasons, onSeasonsChange],
  );

  const toggleOccasion = useCallback(
    (o: Occasion) => onOccasionsChange(
      occasions.includes(o) ? occasions.filter((x) => x !== o) : [...occasions, o]
    ),
    [occasions, onOccasionsChange],
  );

  return (
    <View style={formStyles.container}>
      {/* Photo */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Photo</Text>
        {imageDataUrl ? (
          <View style={formStyles.photoPreview}>
            <Image source={{ uri: imageDataUrl }} style={formStyles.photoImage} resizeMode="cover" />
            {!disabled && (
              <TouchableOpacity
                style={formStyles.photoRemove}
                onPress={() => onImageChange(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color={colors.foreground} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={formStyles.photoPlaceholder}
            onPress={handlePickPhoto}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={28} color={colors.mutedForeground} />
            <Text style={formStyles.photoPlaceholderText}>Add Photo</Text>
            <Text style={formStyles.photoPlaceholderSub}>Optional</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Name */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Item Name *</Text>
        <TextInput
          style={[formStyles.input, disabled && formStyles.inputDisabled]}
          value={name}
          onChangeText={onNameChange}
          placeholder="e.g. Navy Oxford Shirt"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
          editable={!disabled}
        />
      </View>

      {/* Brand autocomplete */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Brand</Text>
        <BrandAutocompleteInput
          value={brand}
          onChangeText={onBrandChange}
          onSelect={onBrandChange}
          suggestions={brandSuggestions}
          placeholder="e.g. Uniqlo"
        />
      </View>

      {/* Category → Subcategory → Style (progressive disclosure) */}
      <TaxonomySelector
        category={category}
        subcategory={subcategory}
        style={itemStyle}
        onCategoryChange={(v) => {
          onCategoryChange((v || null) as ItemCategory | null);
          onSubcategoryChange('');
          onStyleChange('');
        }}
        onSubcategoryChange={onSubcategoryChange}
        onStyleChange={onStyleChange}
        disabled={disabled}
      />

      {/* Colour swatches */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Colour</Text>
        <ColorSwatchGrid
          selected={colorNormalized}
          onSelect={onColorNormalizedChange}
          disabled={disabled}
        />
      </View>

      {/* Season chips */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Season</Text>
        <View style={formStyles.chipRow}>
          {SEASON_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[formStyles.chip, seasons.includes(s) && formStyles.chipSelected]}
              onPress={() => toggleSeason(s)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[formStyles.chipText, seasons.includes(s) && formStyles.chipTextSelected]}>
                {SEASON_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Occasion chips */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Occasion</Text>
        <View style={formStyles.chipRow}>
          {OCCASION_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o}
              style={[formStyles.chip, occasions.includes(o) && formStyles.chipSelected]}
              onPress={() => toggleOccasion(o)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[formStyles.chipText, occasions.includes(o) && formStyles.chipTextSelected]}>
                {OCCASION_LABELS[o]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: { gap: spacing.lg },
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
  inputDisabled: { opacity: 0.5 },
  photoPlaceholder: {
    height: 120,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.muted,
  },
  photoPlaceholderText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  photoPlaceholderSub: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    opacity: 0.7,
  },
  photoPreview: {
    height: 160,
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.background,
    borderRadius: radii.full,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  chipTextSelected: {
    color: colors.primaryForeground,
  },
});

// ─── ColorSwatchGrid ──────────────────────────────────────────────────────────

function ColorSwatchGrid({
  selected,
  onSelect,
  disabled,
}: {
  selected: NormalizedColor | null;
  onSelect: (color: NormalizedColor, displayName: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={swatchStyles.grid}>
      {NORMALIZED_COLORS.map((color) => {
        const hex = NORMALIZED_COLOR_HEX[color];
        const isSelected = selected === color;
        const light = isColorLight(hex);
        const selectedBorderColor = light ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)';
        return (
          <TouchableOpacity
            key={color}
            style={[
              swatchStyles.swatch,
              { backgroundColor: hex, borderColor: isSelected ? selectedBorderColor : 'transparent' },
              isSelected && swatchStyles.swatchSelected,
            ]}
            onPress={() => onSelect(color, normalizedColorDisplayName(color))}
            disabled={disabled}
            activeOpacity={0.75}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={14} color={light ? '#000000' : '#FFFFFF'} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const swatchStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  swatchSelected: {
    transform: [{ scale: 1.05 }],
  },
});

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
