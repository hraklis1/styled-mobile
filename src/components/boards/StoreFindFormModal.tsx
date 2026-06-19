import { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, typography, radii } from '../../theme';
import type { StoreFind } from '../../types/storeFind';
import type { CapturedLocation } from '../../lib/photoLocation';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { useBrandSuggestions } from '../../hooks/useItems';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';

const POPULAR_STORES = [
  // Department stores
  "Bloomingdale's",
  "Dillard's",
  'Holt Renfrew',
  'JCPenney',
  "Kohl's",
  "Macy's",
  'Neiman Marcus',
  'Nordstrom',
  'Nordstrom Rack',
  'Saks Fifth Avenue',
  'Saks OFF 5TH',
  // Fast fashion & specialty
  'Abercrombie & Fitch',
  '& Other Stories',
  'Anthropologie',
  'Arket',
  'Aritzia',
  'ASOS',
  'Banana Republic',
  'Club Monaco',
  'COS',
  'Cotton On',
  'Express',
  'Forever 21',
  'Free People',
  'Gap',
  'H&M',
  'J.Crew',
  'Madewell',
  'Mango',
  'Massimo Dutti',
  'Muji',
  'Old Navy',
  'PacSun',
  'Primark',
  'Pull & Bear',
  'Reiss',
  'Simons',
  'Ted Baker',
  'Topshop',
  'Uniqlo',
  'Urban Outfitters',
  'Weekday',
  'Zara',
  // Activewear
  'Alo Yoga',
  'Athleta',
  'Gymshark',
  'Lululemon',
  'Outdoor Voices',
  'Sweaty Betty',
  'Vuori',
  // Athletic & outdoor
  'Adidas',
  "Arc'teryx",
  'Columbia',
  'Foot Locker',
  'Nike',
  'Patagonia',
  'REI',
  'The North Face',
  'Under Armour',
  // Luxury
  'Balenciaga',
  'Bottega Veneta',
  'Burberry',
  'Chanel',
  'Dior',
  'Gucci',
  'Hermès',
  'Louis Vuitton',
  'Prada',
  'Saint Laurent',
  'Valentino',
  // Contemporary & accessible luxury
  'Coach',
  'Kate Spade',
  'Michael Kors',
  'Tory Burch',
  // Shoes
  'DSW',
  'Steve Madden',
  // Off-price & discount
  'Burlington',
  'Marshalls',
  'Ross',
  'T.J. Maxx',
  'Target',
  'Winners',
  // Online retailers
  'Farfetch',
  'Net-a-Porter',
  'Revolve',
  'Shopbop',
  'SSENSE',
  // Secondhand & consignment
  'Depop',
  'Goodwill',
  'Poshmark',
  'The RealReal',
  'ThredUp',
  'Vestiaire Collective',
  'Vintage Shop',
];

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS', 'Custom'] as const;
const MAX_PHOTOS = 5;

export async function persistStoreFindPhoto(cacheUri: string): Promise<string> {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('Device storage is unavailable.');
  try {
    const storeFindDir = `${dir}store_finds/`;
    await FileSystem.makeDirectoryAsync(storeFindDir, { intermediates: true });
    const dest = `${storeFindDir}${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    await FileSystem.copyAsync({ from: cacheUri, to: dest });
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists || (typeof info.size === 'number' && info.size === 0)) {
      throw new Error('Photo could not be saved.');
    }
    return dest;
  } catch {
    throw new Error('Photo could not be stored on this device.');
  }
}

const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'] as const;

function defaultCurrency(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const region = locale.split('-')[1]?.toUpperCase();
  return ({ CA: 'CAD', US: 'USD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', JP: 'JPY' } as Record<string, string>)[region] ?? 'USD';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<StoreFind, 'id' | 'createdAt'>) => Promise<void>;
  onSaveAndAddAnother?: (data: Omit<StoreFind, 'id' | 'createdAt'>) => Promise<void>;
  initialValues?: StoreFind;
  initialImageUris?: string[];
  initialLocation?: CapturedLocation | null;
};

export function StoreFindFormModal({
  visible,
  onClose,
  onSave,
  onSaveAndAddAnother,
  initialValues,
  initialImageUris = [],
  initialLocation,
}: Props) {
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [store, setStore] = useState('');
  const [brand, setBrand] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [sizePreset, setSizePreset] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<CapturedLocation | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when opened in edit mode; reset when opened in create mode.
  useEffect(() => {
    if (!visible) return;
    if (!initialValues) {
      setImageUris(initialImageUris);
      setDescription('');
      setStore('');
      setBrand('');
      setPriceStr('');
      setSizePreset('');
      setCustomSize('');
      setNotes('');
      setLocation(initialLocation?.label ?? null);
      setLocationData(initialLocation ?? null);
      setDetailsExpanded(false);
      return;
    }
    const size = initialValues.size ?? '';
    const isPreset = (SIZE_PRESETS as readonly string[]).includes(size);
    setImageUris(
      initialValues.imageUrls?.length
        ? initialValues.imageUrls
        : initialValues.imageUrl
        ? [initialValues.imageUrl]
        : [],
    );
    setDescription(initialValues.description ?? '');
    setStore(initialValues.store ?? '');
    setBrand(initialValues.brand ?? '');
    setPriceStr(initialValues.price != null ? String(initialValues.price) : '');
    setSizePreset(isPreset ? size : size ? 'Custom' : '');
    setCustomSize(isPreset || !size ? '' : size);
    setNotes(initialValues.notes ?? '');
    setLocation(initialValues.location ?? null);
    setLocationData(initialValues.locationData ?? null);
    setDetailsExpanded(true);
  }, [visible, initialValues, initialImageUris, initialLocation]);

  const brandSuggestions = useBrandSuggestions();
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();

  const addPhoto = useCallback(async (fromCamera: boolean) => {
    const launch = fromCamera ? launchCamera : launchLibrary;
    const image = await launch({ maxDim: 1080, compress: 0.8 });
    if (!image?.uri) return;
    try {
      const persistent = await persistStoreFindPhoto(image.uri);
      setImageUris((prev) => [...prev, persistent]);
    } catch (error) {
      Alert.alert('Photo not saved', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [launchCamera, launchLibrary]);

  const handleAddPhoto = useCallback(() => {
    Alert.alert('Add Photo', 'Choose a photo source', [
      { text: 'Camera', onPress: () => addPhoto(true) },
      { text: 'Gallery', onPress: () => addPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [addPhoto]);

  const handleRemovePhoto = useCallback((index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleTagLocation = useCallback(async () => {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location access needed',
          'Enable location access in Settings to tag your current location.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () =>
                Platform.OS === 'ios'
                  ? Linking.openURL('app-settings:')
                  : Linking.openSettings(),
            },
          ],
        );
        return;
      }
      const coords = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const results = await Location.reverseGeocodeAsync(coords.coords);
      if (results.length > 0) {
        const r = results[0];
        const name = r.name || r.street || r.city || r.subregion || r.region || 'Unknown Location';
        setLocation(name);
        setLocationData({
          latitude: coords.coords.latitude,
          longitude: coords.coords.longitude,
          label: name,
          address: r.formattedAddress
            || [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(', ')
            || null,
        });
      }
    } catch {
      Alert.alert('Location Error', 'Unable to get your current location. Please try again.');
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  const buildSaveData = (): Omit<StoreFind, 'id' | 'createdAt'> => {
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    const size = sizePreset === 'Custom' ? customSize.trim() : sizePreset;
    return {
      imageUrl: imageUris[0] ?? null,
      imageUrls: imageUris,
      location,
      locationData: locationData ? { ...locationData, label: location } : null,
      description: description.trim() || null,
      store: store.trim() || null,
      brand: brand.trim() || null,
      price: isNaN(price) ? null : price,
      currency: initialValues?.currency ?? defaultCurrency(),
      size: size || null,
      notes: notes.trim() || null,
      syncStatus: 'pending',
      status: 'saved',
      syncError: null,
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    };
  };

  const handleSave = async (addAnother = false) => {
    if (isSubmitting) return;
    if (imageUris.length === 0) {
      Alert.alert('Add a photo', 'Take or choose a photo before saving this find.');
      return;
    }
    setIsSubmitting(true);
    try {
      const data = buildSaveData();
      if (addAnother && onSaveAndAddAnother) await onSaveAndAddAnother(data);
      else await onSave(data);

      setImageUris([]);
      setDescription('');
      setStore('');
      setBrand('');
      setPriceStr('');
      setSizePreset('');
      setCustomSize('');
      setNotes('');
      setLocation(null);
      setLocationData(null);
      onClose();
    } catch (error) {
      Alert.alert('Not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{initialValues ? 'Edit Find' : 'Save Find'}</Text>
          <TouchableOpacity onPress={() => handleSave(false)} style={styles.headerBtn} disabled={isSubmitting}>
            <Text style={[styles.headerBtnText, styles.saveText, isSubmitting && { opacity: 0.4 }]}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Multi-photo strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              contentContainerStyle={styles.photoStripContent}
            >
              {imageUris.map((uri, idx) => (
                <View key={uri + idx} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.thumbImage} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => handleRemovePhoto(idx)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {imageUris.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} activeOpacity={0.7}>
                  <Ionicons name="add" size={28} color={colors.primary} />
                  {imageUris.length === 0 && (
                    <Text style={styles.addPhotoText}>Snap Photo</Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={[styles.form, { zIndex: 1 }]}>
              {detailsExpanded && <View style={[styles.field, { zIndex: 12 }]}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  placeholder='e.g. "dress", "wide bottom jeans"'
                  placeholderTextColor={colors.mutedForeground}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>}

              {/* Store + location tag */}
              <View style={[styles.field, { zIndex: 11 }]}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Store</Text>
                  {!location && (
                    <TouchableOpacity
                      style={styles.locationTagBtn}
                      onPress={handleTagLocation}
                      disabled={isFetchingLocation}
                      accessibilityLabel="Add current location"
                    >
                      {isFetchingLocation ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="location-outline" size={13} color={colors.primary} />
                          <Text style={styles.locationTagText}>Add current location</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                <BrandAutocompleteInput
                  value={store}
                  onChangeText={setStore}
                  onSelect={setStore}
                  suggestions={POPULAR_STORES}
                  placeholder="e.g. Zara, Nordstrom"
                />
                {!!location && (
                  <View style={styles.locationChip}>
                    <Ionicons name="location" size={12} color={colors.mutedForeground} />
                    <Text style={styles.locationChipText} numberOfLines={2}>{location}</Text>
                    <TouchableOpacity
                      style={styles.changeLocationButton}
                      onPress={handleTagLocation}
                      disabled={isFetchingLocation}
                      accessibilityLabel="Change current location"
                    >
                      {isFetchingLocation
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={styles.changeLocationText}>Change</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.clearLocationButton}
                      onPress={() => { setLocation(null); setLocationData(null); }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel="Remove location"
                    >
                      <Ionicons name="close" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {detailsExpanded && <View style={[styles.field, { zIndex: 10 }]}>
                <Text style={styles.label}>Brand</Text>
                <BrandAutocompleteInput
                  value={brand}
                  onChangeText={setBrand}
                  onSelect={setBrand}
                  suggestions={brandSuggestions}
                  placeholder="Brand name"
                />
              </View>}

              {/* Price with $ prefix + Size inline */}
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Price</Text>
                  <View style={styles.priceRow}>
                    <View style={styles.currencyPrefix}>
                      <Text style={styles.currencyText}>$</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.priceInput]}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      value={priceStr}
                      onChangeText={setPriceStr}
                    />
                  </View>
                </View>
              </View>

              {/* Size picker — inline grid, cross-platform */}
              <View style={styles.field}>
                <Text style={styles.label}>Size</Text>
                <View style={styles.sizeGrid}>
                  {SIZE_OPTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sizeBtn, sizePreset === s && styles.sizeBtnActive]}
                      onPress={() => setSizePreset((prev) => (prev === s ? '' : s))}
                    >
                      <Text style={[styles.sizeBtnText, sizePreset === s && styles.sizeBtnTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {sizePreset === 'Custom' && (
                  <TextInput
                    style={[styles.input, { marginTop: spacing.xs }]}
                    placeholder="Enter size (e.g. 32x30, 7.5W)"
                    placeholderTextColor={colors.mutedForeground}
                    value={customSize}
                    onChangeText={setCustomSize}
                    autoFocus
                  />
                )}
              </View>

              {detailsExpanded && <View style={styles.field}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Loved the fabric, wait for sale..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>}

              {!detailsExpanded && (
                <TouchableOpacity style={styles.detailsToggle} onPress={() => setDetailsExpanded(true)}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.detailsToggleText}>Add description, brand or notes</Text>
                </TouchableOpacity>
              )}

              {!initialValues && onSaveAndAddAnother && (
                <TouchableOpacity
                  style={styles.saveAnotherButton}
                  onPress={() => handleSave(true)}
                  disabled={isSubmitting}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.primaryForeground} />
                  <Text style={styles.saveAnotherText}>Save & snap another</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const THUMB_SIZE = 90;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  headerBtn: { padding: spacing.xs },
  headerBtnText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  saveText: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  scroll: {
    padding: spacing.lg,
  },

  // Photo strip
  photoStrip: {
    marginBottom: spacing.xl,
  },
  photoStripContent: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  photoThumb: {
    width: THUMB_SIZE * 1.33,
    height: THUMB_SIZE,
    borderRadius: radii.md,
    overflow: 'visible',
    position: 'relative',
  },
  thumbImage: {
    width: THUMB_SIZE * 1.33,
    height: THUMB_SIZE,
    borderRadius: radii.md,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  addPhotoBtn: {
    width: THUMB_SIZE * 1.33,
    height: THUMB_SIZE,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: `${colors.primary}60`,
    backgroundColor: `${colors.primary}08`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },

  form: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    marginLeft: spacing.xs,
  },
  locationTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    marginRight: spacing.xs,
  },
  locationTagText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    alignSelf: 'stretch',
  },
  locationChipText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  changeLocationButton: {
    minWidth: 54,
    minHeight: 32,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeLocationText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  clearLocationButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
    fontSize: typography.size.md,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },

  // Price with $ prefix
  priceRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  currencyPrefix: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  priceInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    paddingLeft: spacing.sm,
  },

  // Size grid
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sizeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minWidth: 44,
    alignItems: 'center',
  },
  sizeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sizeBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  sizeBtnTextActive: {
    color: colors.primaryForeground,
  },
  detailsToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  detailsToggleText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  saveAnotherButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  saveAnotherText: {
    color: colors.primaryForeground,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

});
