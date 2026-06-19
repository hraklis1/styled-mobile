import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, radii, spacing, typography } from '../../theme';
import type { BoardFeedItem } from '../../types/board';

type Props = {
  visible: boolean;
  items: BoardFeedItem[];
  onClose: () => void;
  onSelect: (imageUrl: string | null) => void;
  onUpload: () => void;
};

export function BoardCoverPickerModal({ visible, items, onClose, onSelect, onUpload }: Props) {
  const choices = items.flatMap((item) => {
    const raw = item.kind === 'item'
      ? item.item.imageUrl
      : item.kind === 'outfit'
      ? item.outfit.aiGeneratedImageUrl
      : item.kind === 'storeFind'
      ? item.storeFind.imageUrls?.[0] ?? item.storeFind.imageUrl
      : null;
    const uri = resolveImageUri(raw ?? undefined);
    return uri ? [{ key: item.key, uri }] : [];
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.side} onPress={onClose}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={styles.title}>Board cover</Text>
          <View style={styles.side} />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => onSelect(null)} accessibilityRole="button">
            <View style={styles.actionIcon}><Ionicons name="grid-outline" size={20} color={colors.primary} /></View>
            <View style={styles.actionInfo}><Text style={styles.actionTitle}>Automatic collage</Text><Text style={styles.actionCopy}>Updates as your board changes</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={onUpload} accessibilityRole="button">
            <View style={styles.actionIcon}><Ionicons name="image-outline" size={20} color={colors.primary} /></View>
            <View style={styles.actionInfo}><Text style={styles.actionTitle}>Upload a photo</Text><Text style={styles.actionCopy}>Choose from your photo library</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Choose from this board</Text>
        <FlatList
          data={choices}
          numColumns={3}
          keyExtractor={(choice) => choice.key}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={<Text style={styles.empty}>Add an image-based piece, outfit, or find to choose it as the cover.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.tile} onPress={() => onSelect(item.uri)} accessibilityRole="button" accessibilityLabel="Use this image as board cover">
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  side: { width: 72, minHeight: 44, justifyContent: 'center' },
  cancel: { color: colors.mutedForeground, fontSize: typography.size.md },
  title: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  actions: { padding: spacing.lg, gap: spacing.sm },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  actionIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  actionInfo: { flex: 1 },
  actionTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  actionCopy: { color: colors.mutedForeground, fontSize: typography.size.xs },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  gridRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  tile: { flex: 1, aspectRatio: 1, maxWidth: '32%', borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.secondary },
  empty: { paddingTop: spacing.xl, color: colors.mutedForeground, fontSize: typography.size.sm, textAlign: 'center' },
});
