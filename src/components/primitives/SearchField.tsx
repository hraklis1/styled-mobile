import { Pressable, StyleSheet, TextInput, View, useWindowDimensions, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

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
 * A filled search capsule with a defined outline, the
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
  const { fontScale } = useWindowDimensions();
  const fieldHeight = Math.max(FIELD_HEIGHT, Math.ceil(typography.text.bodySmall.fontSize * fontScale * 1.25) + 16);
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
        style={[styles.input, { height: fieldHeight }]}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType={inputProps.returnKeyType ?? 'search'}
        accessibilityLabel={accessibilityLabel ?? inputProps.placeholder}
      />
      {showClear ? (
        <Pressable
          onPress={clear}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.controlOutline,
    borderRadius: radii.full,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  clear: { width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceSelected },
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
