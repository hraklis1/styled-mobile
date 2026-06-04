import { useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
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
};

type MultiProps = {
  title: string;
  options: string[];
  multi: true;
  multiValue?: string[];
  onMultiToggle?: (v: string) => void;
  placeholder?: string;
};

type Props = SingleProps | MultiProps;

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomSheetDropdown(props: Props) {
  const { title, options, placeholder } = props;
  const insets = useSafeAreaInsets();

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '75%'], []);

  const handleOpen = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleSelect = useCallback(
    (opt: string) => {
      if (!props.multi) {
        props.onChange?.(opt);
        bottomSheetRef.current?.dismiss();
      } else {
        props.onMultiToggle?.(opt);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.multi, (props as any).onChange, (props as any).onMultiToggle]
  );

  const renderBackdrop = useCallback(
    (bsProps: any) => (
      <BottomSheetBackdrop {...bsProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
    ),
    []
  );

  const renderFooter = useCallback(
    (footerProps: BottomSheetFooterProps) => (
      <BottomSheetFooter {...footerProps} bottomInset={insets.bottom}>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => bottomSheetRef.current?.dismiss()}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetFooter>
    ),
    [insets.bottom]
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

  // ── List item renderer ───────────────────────────────────────────────────────

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

  const keyExtractor = useCallback((item: string) => item, []);

  const listHeader = !isMulti ? (
    <TouchableOpacity
      style={styles.option}
      onPress={() => {
        (props as SingleProps).onChange?.('');
        bottomSheetRef.current?.dismiss();
      }}
      activeOpacity={0.7}
    >
      <Text style={[styles.optionText, styles.optionTextMuted]}>— None —</Text>
      {!singleValue && <Ionicons name="checkmark" size={18} color={colors.primary} />}
    </TouchableOpacity>
  ) : null;

  return (
    <>
      <PressableScale contentStyle={styles.button} onPress={handleOpen}>
        <Text
          style={[styles.buttonText, !hasValue && styles.placeholder]}
          numberOfLines={1}
        >
          {buttonLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
      </PressableScale>

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        footerComponent={isMulti ? renderFooter : undefined}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBackground}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <BottomSheetFlatList
            data={options}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{
              paddingBottom: isMulti
                ? Math.max(insets.bottom, spacing.lg) + 64
                : Math.max(insets.bottom, spacing.lg),
            }}
          />
        </View>
      </BottomSheetModal>
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
  sheetBackground: {
    backgroundColor: colors.background,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },
  sheetContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
