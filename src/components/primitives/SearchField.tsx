import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

type Props = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
  /** Clears the field; when the field is dismissible, also closes it. */
  onClear?: () => void;
  /** Always show the trailing control, even when empty (a dismissible search). */
  dismissible?: boolean;
  style?: StyleProp<ViewStyle>;
};

const FIELD_HEIGHT = 44;

/**
 * The one search treatment: an elevated ivory pill with a hairline edge, the
 * same height as the filter and view controls it sits beside. Screens should
 * use this rather than composing an icon + TextInput of their own.
 */
export function SearchField({
  value,
  onChangeText,
  onClear,
  dismissible = false,
  style,
  accessibilityLabel,
  ...inputProps
}: Props) {
  const showClear = dismissible || value.length > 0;
  const clear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search-outline" size={16} color={colors.mutedForeground} style={styles.icon} />
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType={inputProps.returnKeyType ?? 'search'}
        accessibilityLabel={accessibilityLabel ?? inputProps.placeholder}
      />
      {showClear ? (
        <Pressable
          onPress={clear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={dismissible ? 'Close search' : 'Clear search'}
        >
          <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: { flexShrink: 0 },
  input: {
    flex: 1,
    height: FIELD_HEIGHT,
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: typography.inputLineHeight(typography.text.bodySmall.fontSize),
    color: colors.foreground,
    paddingVertical: 0,
  },
});
