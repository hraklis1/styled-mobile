import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActionSheetIOS,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';
import { colors, spacing, typography, radii } from '../../theme';
import {
  SEASON_OPTIONS, SEASON_LABELS, OCCASION_OPTIONS, OCCASION_LABELS,
  type ItemCategory, type NormalizedColor, type Season, type Occasion,
} from '../../types/item';
import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { ColorSwatchGrid } from './ColorSwatchGrid';

interface ManualEntryFormProps {
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
}

export function ManualEntryForm({
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
}: ManualEntryFormProps) {
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
    <View style={styles.container}>
      {/* Photo */}
      <View style={styles.field}>
        <Text style={styles.label}>Photo</Text>
        {imageDataUrl ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: imageDataUrl }} style={styles.photoImage} resizeMode="cover" />
            {!disabled && (
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => onImageChange(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color={colors.foreground} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.photoPlaceholder}
            onPress={handlePickPhoto}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={28} color={colors.mutedForeground} />
            <Text style={styles.photoPlaceholderText}>Add Photo</Text>
            <Text style={styles.photoPlaceholderSub}>Optional</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Name */}
      <View style={styles.field}>
        <Text style={styles.label}>Item Name *</Text>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
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
      <View style={styles.field}>
        <Text style={styles.label}>Brand</Text>
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
      <View style={styles.field}>
        <Text style={styles.label}>Colour</Text>
        <ColorSwatchGrid
          selected={colorNormalized}
          onSelect={onColorNormalizedChange}
          disabled={disabled}
        />
      </View>

      {/* Season chips */}
      <View style={styles.field}>
        <Text style={styles.label}>Season</Text>
        <View style={styles.chipRow}>
          {SEASON_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, seasons.includes(s) && styles.chipSelected]}
              onPress={() => toggleSeason(s)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, seasons.includes(s) && styles.chipTextSelected]}>
                {SEASON_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Occasion chips */}
      <View style={styles.field}>
        <Text style={styles.label}>Occasion</Text>
        <View style={styles.chipRow}>
          {OCCASION_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.chip, occasions.includes(o) && styles.chipSelected]}
              onPress={() => toggleOccasion(o)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, occasions.includes(o) && styles.chipTextSelected]}>
                {OCCASION_LABELS[o]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
