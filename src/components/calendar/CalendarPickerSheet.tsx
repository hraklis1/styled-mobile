import { useState, useEffect, useRef } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, spacing, typography, radii } from '../../theme';

export function CalendarPickerSheet({
  visible,
  inline = false,
  value,
  mode,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
}: {
  visible: boolean;
  /** Render over an existing native modal without presenting a second one. */
  inline?: boolean;
  value: Date;
  mode: 'date' | 'time';
  onConfirm: (d: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [local, setLocal] = useState(value);
  const confirmRef = useRef(onConfirm);
  const cancelRef = useRef(onCancel);
  useEffect(() => { if (visible) setLocal(value); }, [visible, value]);
  useEffect(() => { confirmRef.current = onConfirm; }, [onConfirm]);
  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    if (!visible || process.env.EXPO_OS !== 'android') return;
    DateTimePickerAndroid.open({
      value,
      mode,
      display: 'default',
      minimumDate,
      maximumDate,
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) confirmRef.current(selected);
        else cancelRef.current();
      },
    });
  }, [maximumDate, minimumDate, mode, value, visible]);

  if (process.env.EXPO_OS === 'android') return null;

  const pickerContent = (
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
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onValueChange={(_, d) => { if (d) setLocal(d); }}
            style={{ height: 200 }}
          />
        </View>
      </View>
  );

  if (inline) return visible ? pickerContent : null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      {pickerContent}
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' },
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
