import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandPicker } from '../wardrobe/scan-review/pickers';
import { selectionFeedback } from '../wardrobe/scan-review/feedback';
import { useBrandSuggestions, useClosetBrands } from '../../hooks/useItems';
import { colors, spacing, typography } from '../../theme';

/**
 * The same brand search used while adding clothes, presented as a native page
 * sheet so a saved item can gain (or change) its brand in two taps.
 */
export function BrandSheet({ visible, current, onSelect, onClose }: {
  visible: boolean;
  current: string;
  onSelect: (brand: string) => void;
  onClose: () => void;
}) {
  const suggestions = useBrandSuggestions(visible);
  const closetBrands = useClosetBrands(visible);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Brand</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <BrandPicker
          current={current}
          suggestions={suggestions}
          closetBrands={closetBrands}
          scanBrands={[]}
          onSelect={(brand) => { selectionFeedback(); onSelect(brand.trim()); }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.lg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.page, paddingBottom: spacing.md,
  },
  title: { ...typography.text.editorialTitle, fontSize: 24, lineHeight: 30, color: colors.foreground },
  cancel: { ...typography.text.meta, color: colors.mutedForeground },
});
