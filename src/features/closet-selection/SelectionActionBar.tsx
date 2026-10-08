import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../../components/primitives/PressableScale';
import { ActionMenuSheet, type ActionMenuOption } from '../../components/primitives/ActionMenuSheet';
import { colors, radii, shadows, spacing, typography } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type SelectionAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  destructive?: boolean;
};

export type SelectionPrimaryAction = SelectionAction & {
  disabled?: boolean;
  /** Why it is disabled, shown in place of the label. */
  hint?: string;
};

/** Gap between the capsule and the home indicator. */
const FLOAT_GAP = 12;
/** Height of the capsule with and without the primary row; lists pad by this. */
export const SELECTION_BAR_HEIGHT = { compact: 64, withPrimary: 64 + 52 };

export function selectionBarClearance(bottomInset: number, withPrimary: boolean) {
  return (withPrimary ? SELECTION_BAR_HEIGHT.withPrimary : SELECTION_BAR_HEIGHT.compact) + Math.max(bottomInset, spacing.md) + FLOAT_GAP + spacing.lg;
}

/**
 * The floating glass capsule a closet selection acts from. It only exists
 * while something is selected: an empty selection has nothing to act on, and
 * a ghosted bar read as broken.
 */
export function SelectionActionBar({ count, noun, primary, actions, overflow }: {
  count: number;
  /** "piece" / "outfit", for the overflow sheet title. */
  noun: string;
  primary?: SelectionPrimaryAction;
  actions: SelectionAction[];
  overflow: SelectionAction[];
}) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  if (count === 0 && !menuOpen) return null;

  const menuOptions: ActionMenuOption[] = overflow.map(action => ({
    label: action.label, icon: action.icon, destructive: action.destructive, onPress: action.onPress,
  }));

  return (
    <>
      {count > 0 && (
        <Animated.View
          entering={FadeInDown.springify().damping(18).stiffness(220).reduceMotion(ReduceMotion.System)}
          exiting={FadeOutDown.duration(140).reduceMotion(ReduceMotion.System)}
          style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.md) + FLOAT_GAP }]}
        >
          <View style={styles.capsule}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.tint]} />

            {primary && (
              <PressableScale
                onPress={primary.onPress}
                disabled={primary.disabled}
                contentStyle={[styles.primary, primary.disabled && styles.primaryDisabled]}
                accessibilityRole="button"
                accessibilityLabel={primary.accessibilityLabel ?? primary.label}
                accessibilityHint={primary.disabled ? primary.hint : undefined}
                accessibilityState={{ disabled: !!primary.disabled }}
              >
                <Ionicons name={primary.icon} size={16} color={primary.disabled ? colors.mutedForeground : colors.primaryForeground} />
                <Text style={[styles.primaryText, primary.disabled && styles.primaryTextDisabled]} numberOfLines={1}>
                  {primary.disabled && primary.hint ? primary.hint : primary.label}
                </Text>
              </PressableScale>
            )}

            <View style={styles.actions}>
              {actions.map(action => (
                <ActionButton key={action.label} action={action} />
              ))}
              {overflow.length > 0 && (
                <ActionButton action={{ label: 'More', icon: 'ellipsis-horizontal', onPress: () => setMenuOpen(true), accessibilityLabel: 'More actions' }} />
              )}
            </View>
          </View>
        </Animated.View>
      )}

      <ActionMenuSheet
        visible={menuOpen}
        title={`${count} ${noun}${count === 1 ? '' : 's'}`}
        options={menuOptions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

function ActionButton({ action }: { action: SelectionAction }) {
  const tint = action.destructive ? colors.error : colors.foreground;
  return (
    <PressableScale
      onPress={action.onPress}
      contentStyle={styles.action}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
    >
      <Ionicons name={action.icon} size={21} color={tint} />
      <Text style={[styles.actionText, { color: tint }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{action.label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.page,
    right: spacing.page,
    zIndex: 20,
    ...shadows.actionCard,
    shadowOpacity: 0.14,
    shadowRadius: 20,
  },
  capsule: {
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ghostStroke,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  tint: { backgroundColor: 'rgba(255,255,255,0.62)' },
  primary: {
    height: 46,
    borderRadius: radii.action,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryDisabled: { backgroundColor: colors.surfaceSelected },
  primaryText: { ...typography.text.body, fontWeight: typography.weight.medium, color: colors.primaryForeground },
  primaryTextDisabled: { color: colors.mutedForeground },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { minWidth: 64, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: spacing.xs },
  actionText: { ...typography.text.caption, fontSize: 11, letterSpacing: 0.2 },
});
