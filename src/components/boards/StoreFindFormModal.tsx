import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, radii } from '../../theme';
import type { StoreFind } from '../../types/storeFind';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { useBrandSuggestions } from '../../hooks/useItems';

const POPULAR_STORES = [
  'Abercrombie & Fitch', 'Anthropologie', 'Aritzia', 'ASOS', "Bloomingdale's",
  'Free People', 'Gap', 'H&M', 'J.Crew', "Macy's", 'Madewell', 'Nordstrom',
  'Old Navy', 'PacSun', 'Saks Fifth Avenue', 'Target', 'Thrift Store', 
  'Uniqlo', 'Urban Outfitters', 'Vintage Shop', 'Walmart', 'Zara'
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<StoreFind, 'id' | 'createdAt'>) => void;
};

export function StoreFindFormModal({ visible, onClose, onSave }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [store, setStore] = useState('');
  const [brand, setBrand] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');
  const [interestLevel, setInterestLevel] = useState(3);
  
  const brandSuggestions = useBrandSuggestions();

  const handleTakePic = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera permissions to snap a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUrl(result.assets[0].uri);
      // In a real app we might also request location here to get coordinates
    }
  };

  const handleSave = () => {
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    
    onSave({
      imageUrl,
      location: null, // Would be gathered via Location API
      store: store.trim() || null,
      brand: brand.trim() || null,
      price: isNaN(price) ? null : price,
      size: size.trim() || null,
      notes: notes.trim() || null,
      interestLevel,
    });
    
    // Reset
    setImageUrl(null);
    setStore('');
    setBrand('');
    setPriceStr('');
    setSize('');
    setNotes('');
    setInterestLevel(3);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Store Find</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, styles.saveText]}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <TouchableOpacity style={styles.imagePicker} onPress={handleTakePic} activeOpacity={0.8}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={styles.imagePlaceholderText}>Snap Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={[styles.form, { zIndex: 1 }]}>
              <View style={[styles.field, { zIndex: 11 }]}>
                <Text style={styles.label}>Store</Text>
                <BrandAutocompleteInput
                  value={store}
                  onChangeText={setStore}
                  onSelect={setStore}
                  suggestions={POPULAR_STORES}
                  placeholder="e.g. Zara, Nordstrom"
                />
              </View>

              <View style={[styles.field, { zIndex: 10 }]}>
                <Text style={styles.label}>Brand</Text>
                <BrandAutocompleteInput
                  value={brand}
                  onChangeText={setBrand}
                  onSelect={setBrand}
                  suggestions={brandSuggestions}
                  placeholder="Brand name"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="$0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={priceStr}
                    onChangeText={setPriceStr}
                  />
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Size</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="M, 32, etc."
                    placeholderTextColor={colors.mutedForeground}
                    value={size}
                    onChangeText={setSize}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Interest Level (1-5)</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.ratingBtn, interestLevel === level && styles.ratingBtnActive]}
                      onPress={() => setInterestLevel(level)}
                    >
                      <Text style={[styles.ratingText, interestLevel === level && styles.ratingTextActive]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Loved the fabric, wait for sale..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

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
  imagePicker: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: `${colors.primary}10`,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderStyle: 'dashed',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  imagePlaceholderText: {
    color: colors.primary,
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
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    marginLeft: spacing.xs,
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
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratingBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ratingBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  ratingTextActive: {
    color: colors.primaryForeground,
  },
});
