import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../../theme';
import { HairlineProgress } from './HairlineProgress';

/**
 * Frame shared by every onboarding step: a quiet header (back chevron,
 * progress line, skip), the step body, and a footer holding one action.
 *
 * Deliberately sparse — no badge, no icon. The photography and the display
 * type carry the screen; chrome stays out of the way.
 */
export function OnboardingShell({
  progress,
  onBack,
  onSkip,
  skipLabel = 'Skip',
  footer,
  children,
}: {
  progress?: { index: number; total: number } | null;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const hit = { top: 12, bottom: 12, left: 12, right: 12 };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[s.container, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={s.header}>
          <View style={s.side}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} hitSlop={hit} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={s.progress}>{progress ? <HairlineProgress {...progress} /> : null}</View>
          <View style={[s.side, s.sideRight]}>
            {onSkip ? (
              <TouchableOpacity onPress={onSkip} hitSlop={hit} style={s.skipBtn} accessibilityRole="button">
                <Text style={s.skipText}>{skipLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={s.body}>{children}</View>

        <View style={s.footer}>{footer}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: spacing.xl },
  side: { width: 72, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  progress: { flex: 1 },
  iconBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', marginLeft: -spacing.sm },
  skipBtn: { minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground },
  body: { flex: 1 },
  footer: { paddingTop: spacing.lg },
});
