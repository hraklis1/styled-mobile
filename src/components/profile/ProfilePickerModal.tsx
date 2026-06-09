import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '../../theme';

type Opt = { value: string; label: string };

const ITEM_H = 50;

export function ProfilePickerModal({
  visible, title, options, value, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: Opt[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const selectedIdx = options.findIndex((o) => o.value === value);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          getItemLayout={(_d, idx) => ({ length: ITEM_H, offset: ITEM_H * idx, index: idx })}
          initialScrollIndex={selectedIdx > 0 ? selectedIdx : 0}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => { onSelect(item.value); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, item.value === value && styles.rowLabelSel]}>{item.label}</Text>
              {item.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    maxHeight: '70%',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center',
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  doneBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  doneText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, height: ITEM_H },
  rowLabel: { fontSize: typography.size.sm, color: colors.foreground },
  rowLabelSel: { color: colors.primary, fontWeight: typography.weight.semibold },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
