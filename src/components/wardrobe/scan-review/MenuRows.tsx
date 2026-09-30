import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, stroke, typography } from '../../../theme';
import { warningFeedback } from './feedback';

/** Rows for the review workspaces' options sheets. */
export function MenuRow({ icon, label, onPress, disabled, destructive }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const tint = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surfaceSelected }, disabled && { opacity: 0.4 }]}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.menuLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const DISARM_MS = 3500;

/**
 * Destructive row that confirms in place: the first tap arms it (the row
 * turns red and says what will go), the second discards. Leaving it alone
 * disarms it. Saves a stacked confirmation screen on top of the sheet.
 */
export function ArmedDiscardRow({ label = 'Discard import', detail, onConfirm }: { label?: string; detail: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  const tint = armed ? colors.background : colors.destructive;
  return (
    <Pressable
      onPress={() => {
        if (armed) return onConfirm();
        warningFeedback();
        setArmed(true);
      }}
      accessibilityRole="button"
      accessibilityLabel={armed ? `Confirm discard. ${detail} will be removed` : label}
      accessibilityHint={armed ? undefined : 'Tap again to confirm'}
      style={({ pressed }) => [styles.menuRow, armed && styles.discardArmed, pressed && { opacity: 0.85 }]}>
      <Ionicons name="trash-outline" size={20} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { flex: 0, color: tint }]}>{armed ? 'Tap again to discard' : label}</Text>
        {armed ? <Animated.Text entering={FadeInDown.duration(160)} style={[styles.discardDetail, { color: tint }]}>{detail}</Animated.Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: stroke.hairline, borderBottomColor: colors.hairline },
  menuLabel: { ...typography.text.body, flex: 1 },
  discardArmed: { backgroundColor: colors.destructive, borderBottomColor: colors.destructive },
  discardDetail: { ...typography.text.bodySmall, opacity: 0.85 },
});
