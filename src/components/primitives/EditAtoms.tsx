import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';
import { PressableScale } from './PressableScale';

export function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function EditLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function EditInput({
  value, onChangeText, placeholder, multiline, maxLength, autoCapitalize,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      returnKeyType={multiline ? 'default' : 'done'}
    />
  );
}

export function OptionChips<T extends string>({
  options,
  value,
  onSelect,
  multi,
  multiValue,
  onMultiToggle,
}: {
  options: { value: T; label: string }[] | string[];
  value?: T | null;
  onSelect?: (v: T) => void;
  multi?: boolean;
  multiValue?: string[];
  onMultiToggle?: (v: string) => void;
}) {
  return (
    <View style={styles.optionChipsRow}>
      {(options as any[]).map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const active = multi
          ? (multiValue ?? []).includes(val)
          : value === val;
        return (
          <PressableScale
            key={val}
            contentStyle={[styles.optionChip, active && styles.optionChipActive]}
            onPress={() => {
              if (multi && onMultiToggle) onMultiToggle(val);
              else if (onSelect) onSelect(val as T);
            }}
          >
            <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
              {lbl}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: spacing.sm + 2,
  },
  optionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  optionChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionChipActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  optionChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  optionChipTextActive: {
    color: colors.background,
  },
});
