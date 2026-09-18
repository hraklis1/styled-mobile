import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
  suggestions?: readonly string[];
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
  suggestions = [],
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
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.formScroll}>
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

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsLabel}>Start with a theme</Text>
              <View style={styles.suggestionOptions}>
                {suggestions.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.suggestion, value === name && styles.suggestionSelected]}
                    onPress={() => setValue(name)}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityState={{ selected: value === name, disabled: submitting }}
                  >
                    <Text style={styles.suggestionText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
          </ScrollView>
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
  formScroll: { flexGrow: 0 },
  sheet: {
    maxHeight: '90%',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
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
    ...typography.text.editorialSheet, color: colors.foreground,
  },
  subtitle: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
  closeButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  input: {
    minHeight: 52,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.action,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    fontSize: typography.text.body.fontSize,
    borderCurve: 'continuous',
  },
  suggestions: { gap: spacing.sm, marginTop: spacing.xl },
  suggestionsLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  suggestionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestion: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.action },
  suggestionSelected: { backgroundColor: colors.surfaceSelected },
  suggestionText: { ...typography.text.bodySmall, color: colors.foreground },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.action,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  cancelText: { color: colors.mutedForeground, fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium },
  submitButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.action,
    backgroundColor: colors.primary,
    borderCurve: 'continuous',
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitText: {
    ...typography.text.label, color: colors.primaryForeground,
  },
});
