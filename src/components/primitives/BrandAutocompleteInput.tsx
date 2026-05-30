import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';

const MAX_SUGGESTIONS = 6;

interface BrandAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Called when the user taps a suggestion or submits the typed value. */
  onSelect: (brand: string) => void;
  /** Full suggestion list — filtered internally by `value`. */
  suggestions: string[];
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

export function BrandAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  suggestions,
  placeholder = 'Brand (if known)',
  style,
  containerStyle,
  autoFocus,
  onBlur,
  onFocus,
}: BrandAutocompleteInputProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const filtered = value.trim().length > 0
    ? suggestions
        .filter((s) => s.toLowerCase().includes(value.trim().toLowerCase()))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const showDropdown = dropdownOpen && filtered.length > 0;

  const handleSelect = useCallback(
    (brand: string) => {
      onSelect(brand);
      setDropdownOpen(false);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const handleFocus = () => {
    setDropdownOpen(true);
    onFocus?.();
  };

  const handleBlur = () => {
    // Delay so a tap on a suggestion fires before the blur hides the list.
    setTimeout(() => {
      setDropdownOpen(false);
      onBlur?.();
    }, 150);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setDropdownOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={[styles.input, style]}
      />

      {showDropdown && (
        <ScrollView
          style={styles.dropdown}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {filtered.map((brand) => (
            <TouchableOpacity
              key={brand}
              style={styles.suggestion}
              onPress={() => handleSelect(brand)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>{brand}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    maxHeight: 180,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
});
