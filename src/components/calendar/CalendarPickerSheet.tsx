import { useState, useEffect } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, typography, radii } from '../../theme';

export function CalendarPickerSheet({
  visible,
  value,
  mode,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { if (visible) setLocal(value); }, [visible, value]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onCancel} activeOpacity={1} />
        <View style={s.sheet}>
          <View style={s.toolbar}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={s.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(local)}>
              <Text style={s.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={local}
            mode={mode}
            display="spinner"
            onChange={(_, d) => { if (d) setLocal(d); }}
            style={{ height: 200 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 32,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: { fontSize: typography.size.md, color: colors.mutedForeground },
  doneBtn: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary },
});
