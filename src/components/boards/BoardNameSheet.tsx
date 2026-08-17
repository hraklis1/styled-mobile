import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  initialValue?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  submitting?: boolean;
};

export function BoardNameSheet({
  visible,
  title,
  subtitle,
  initialValue = '',
  submitLabel,
  onCancel,
  onSubmit,
  submitting = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!visible) return;
    setValue(initialValue);
    const timer = setTimeout(() => inputRef.current?.focus(), 220);
    return () => clearTimeout(timer);
  }, [initialValue, visible]);

  const canSubmit = value.trim().length > 0 && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={19} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={setValue}
            style={styles.input}
            placeholder="Board name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="done"
            maxLength={120}
            onSubmitEditing={() => { if (canSubmit) onSubmit(value.trim()); }}
            accessibilityLabel="Board name"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={() => onSubmit(value.trim())}
              disabled={!canSubmit}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
            >
              <Text style={styles.submitText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(29, 27, 24, 0.45)',
  },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.background,
    borderCurve: 'continuous',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: {
    color: colors.foreground,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  subtitle: { color: colors.mutedForeground, fontSize: typography.size.sm },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
  },
  input: {
    minHeight: 50,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    fontSize: typography.size.md,
    borderCurve: 'continuous',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  cancelText: { color: colors.mutedForeground, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  submitButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    borderCurve: 'continuous',
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitText: { color: colors.primaryForeground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
});
