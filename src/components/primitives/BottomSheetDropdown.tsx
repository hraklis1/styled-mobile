import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
  Animated,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '../../theme';
import { PressableScale } from './PressableScale';

// ─── Types ────────────────────────────────────────────────────────────────────

type SingleProps = {
  title: string;
  options: string[];
  value?: string | null;
  onChange?: (v: string) => void;
  placeholder?: string;
  multi?: false;
  searchable?: boolean;
};

type MultiProps = {
  title: string;
  options: string[];
  multi: true;
  multiValue?: string[];
  onMultiToggle?: (v: string) => void;
  placeholder?: string;
  searchable?: boolean;
};

type Props = SingleProps | MultiProps;

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomSheetDropdown(props: Props) {
  const { title, options, placeholder, searchable } = props;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(600)).current;

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [options, query, searchable]);

  const openSheet = useCallback(() => {
    backdropAnim.setValue(0);
    sheetAnim.setValue(600);
    setQuery('');
    setOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, [backdropAnim, sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
    ]).start(() => { setOpen(false); setQuery(''); });
  }, [backdropAnim, sheetAnim]);

  const handleSelect = useCallback(
    (opt: string) => {
      if (!props.multi) {
        props.onChange?.(opt);
        closeSheet();
      } else {
        props.onMultiToggle?.(opt);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.multi, (props as any).onChange, (props as any).onMultiToggle, closeSheet]
  );

  const buttonLabel = useMemo(() => {
    if (props.multi) {
      const selected = props.multiValue ?? [];
      if (selected.length === 0) return placeholder ?? 'Select…';
      if (selected.length === 1) return selected[0];
      return `${selected.length} selected`;
    }
    return props.value || placeholder || 'Select…';
  }, [props, placeholder]);

  const hasValue = props.multi
    ? (props.multiValue?.length ?? 0) > 0
    : !!props.value;

  const isMulti = props.multi;
  const multiValue = isMulti ? ((props as MultiProps).multiValue ?? []) : [];
  const singleValue = !isMulti ? ((props as SingleProps).value ?? '') : '';

  const renderItem = useCallback(
    ({ item: opt }: { item: string }) => {
      const isSelected = isMulti ? multiValue.includes(opt) : singleValue === opt;
      return (
        <TouchableOpacity
          style={[styles.option, isSelected && styles.optionSelected]}
          onPress={() => handleSelect(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {opt}
          </Text>
          {isMulti ? (
            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
              {isSelected && <Ionicons name="checkmark" size={14} color={colors.background} />}
            </View>
          ) : (
            isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
      );
    },
    [isMulti, multiValue, singleValue, handleSelect]
  );

  const listHeader = !isMulti ? (
    <TouchableOpacity
      style={styles.option}
      onPress={() => {
        (props as SingleProps).onChange?.('');
        closeSheet();
      }}
      activeOpacity={0.7}
    >
      <Text style={[styles.optionText, styles.optionTextMuted]}>— None —</Text>
      {!singleValue && <Ionicons name="checkmark" size={18} color={colors.primary} />}
    </TouchableOpacity>
  ) : null;

  return (
    <>
      <PressableScale contentStyle={styles.button} onPress={openSheet}>
        <Text
          style={[styles.buttonText, !hasValue && styles.placeholder]}
          numberOfLines={1}
        >
          {buttonLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
      </PressableScale>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <View style={styles.overlay}>
          {/* Backdrop fades in independently */}
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          {/* Sheet slides up independently */}
          <Animated.View style={{ transform: [{ translateY: sheetAnim }] }}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{title}</Text>
              {searchable && (
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={16} color={colors.mutedForeground} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search…"
                    placeholderTextColor={colors.mutedForeground}
                    autoCorrect={false}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />
                </View>
              )}
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={listHeader}
                contentContainerStyle={{ paddingBottom: isMulti ? 72 : 0 }}
                keyboardShouldPersistTaps="handled"
              />
              {isMulti && (
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={closeSheet}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    minHeight: 44,
  },
  buttonText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.xs,
  },
  placeholder: {
    color: colors.mutedForeground,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 4,
    borderTopRightRadius: radii.lg + 4,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.muted,
  },
  optionText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  optionTextMuted: {
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
