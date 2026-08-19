import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { track } from '../../lib/analytics';
import { colors, radii, spacing, typography } from '../../theme';
import { useOnboardingForm, type OnboardingValues } from './useOnboardingForm';
import {
  StepBodyFit,
  StepColorBudget,
  StepIntro,
  StepLocationSizing,
  StepOccasions,
  StepStyle,
} from './steps/CoreSteps';
import { StepAvoids, StepShopping, StepSizes } from './steps/DeepDiveSteps';
import { DeepDiveGate, SummaryStep } from './steps/Interstitials';

/**
 * The first-run style questionnaire.
 *
 * Shape: six required steps, then a gate, then three optional ones and a
 * summary. The split exists so the required path can stay short while the
 * questions that most sharpen recommendations — what you won't wear, how you
 * shop, your remaining sizes — still get asked of anyone willing.
 *
 * Answers checkpoint on every advance (see `useOnboardingForm`), so the flow is
 * safe to abandon at any point and safe to re-enter.
 */

type StepDef = {
  key: string;
  eyebrow: string;
  title: string;
  desc?: string;
  render: (props: {
    values: OnboardingValues;
    set: <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => void;
  }) => React.ReactNode;
  /** Undefined means the step can always be advanced. */
  isValid?: (v: OnboardingValues) => boolean;
};

const CORE_STEPS: StepDef[] = [
  {
    key: 'intro',
    eyebrow: 'INTRODUCTIONS',
    title: 'First, the basics.',
    desc: 'Two answers that shape everything after them.',
    render: (p) => <StepIntro {...p} />,
    isValid: (v) => v.displayName.trim().length > 0 && v.fitPreference !== '',
  },
  {
    key: 'occasions',
    eyebrow: 'YOUR WEEK',
    title: 'What do you dress for?',
    desc: 'This decides which outfits we build first.',
    render: (p) => <StepOccasions {...p} />,
    isValid: (v) => v.occasions.length > 0,
  },
  {
    key: 'style',
    eyebrow: 'AESTHETIC',
    title: "What's your taste?",
    desc: 'Most people are a mix. Pick the ones you keep coming back to.',
    render: (p) => <StepStyle {...p} />,
    isValid: (v) => v.stylePreference.length > 0,
  },
  {
    key: 'color-budget',
    eyebrow: 'COLOUR & SPEND',
    title: 'Palette and budget.',
    render: (p) => <StepColorBudget {...p} />,
    isValid: (v) => v.colorPalette.length > 0 && v.budgetRange.length > 0,
  },
  {
    key: 'body-fit',
    eyebrow: 'FIT',
    title: 'How things sit on you.',
    desc: 'The difference between a suggestion and one you actually wear.',
    render: (p) => <StepBodyFit {...p} />,
    isValid: (v) => v.bodyType.length > 0 && v.fitSilhouette !== '',
  },
  {
    key: 'location-sizing',
    eyebrow: 'WHERE YOU ARE',
    title: 'Weather and sizing.',
    render: (p) => <StepLocationSizing {...p} />,
    isValid: (v) => v.sizingRegion !== '',
  },
];

const DEEP_DIVE_STEPS: StepDef[] = [
  {
    key: 'gate',
    eyebrow: '',
    title: '',
    render: () => null,
  },
  {
    key: 'avoids',
    eyebrow: 'THE NO LIST',
    title: 'Anything you never wear?',
    desc: "Knowing what to leave out is worth more than another thing you like.",
    render: (p) => <StepAvoids {...p} />,
  },
  {
    key: 'shopping',
    eyebrow: 'HOW YOU SHOP',
    title: 'When you buy something new.',
    render: (p) => <StepShopping {...p} />,
  },
  {
    key: 'sizes',
    eyebrow: 'SIZING',
    title: 'The rest of your sizes.',
    desc: 'Private, and only used to keep recommendations wearable.',
    render: (p) => <StepSizes {...p} />,
  },
  {
    key: 'summary',
    eyebrow: '',
    title: '',
    render: () => null,
  },
];

const ALL_STEPS = [...CORE_STEPS, ...DEEP_DIVE_STEPS];
const GATE_INDEX = CORE_STEPS.length;
const SUMMARY_INDEX = ALL_STEPS.length - 1;

/** @param onExit Called once the profile has actually saved. See AppGate's latch. */
export function OnboardingScreen({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { values, set, isLoading, isSaving, saveCheckpoint, finish } = useOnboardingForm();

  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const current = ALL_STEPS[step];
  const inCore = step < GATE_INDEX;
  const isGate = step === GATE_INDEX;
  const isSummary = step === SUMMARY_INDEX;
  const canAdvance = current.isValid ? current.isValid(values) : true;

  const progress = useMemo(
    () => (inCore ? { index: step, total: CORE_STEPS.length } : null),
    [inCore, step],
  );

  const go = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleNext = () => {
    track('onboarding_step_completed', {
      step: current.key,
      index: step,
      occasions: values.occasions.length,
      styles: values.stylePreference.length,
      palettes: values.colorPalette.length,
      budgets: values.budgetRange.length,
      proportions: values.bodyType.length,
    });

    // Crossing the gate is what completes onboarding: everything after it is
    // optional, so the user must not be held in the flow to reach the app.
    if (step === GATE_INDEX - 1) {
      finish();
    } else {
      saveCheckpoint();
    }
    go(step + 1);
  };

  const handleDone = () => {
    track('onboarding_completed', { skipped: false, deepDive: true });
    finish(onExit);
  };

  const handleSkip = () => {
    // Saves whatever has been answered so far. The old flow discarded it.
    track('onboarding_completed', { skipped: true, atStep: current.key });
    finish(onExit);
  };

  if (isLoading) {
    return (
      <View style={[s.container, s.loading]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          s.container,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={s.headerRow}>
          <View style={s.sparkleWrap}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          {!isSummary && (
            <TouchableOpacity
              onPress={handleSkip}
              disabled={isSaving}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={s.skipBtn}
              accessibilityRole="button"
            >
              <Text style={s.skipText}>
                {isSaving ? 'Saving…' : isGate || step > GATE_INDEX ? 'Not now' : 'Skip for now'}
              </Text>
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {current.eyebrow ? <Text style={s.eyebrow}>{current.eyebrow}</Text> : null}
        {current.title ? <Text style={s.title}>{current.title}</Text> : null}
        {current.desc ? <Text style={s.desc}>{current.desc}</Text> : null}

        {progress && (
          <View style={s.progressRow}>
            {CORE_STEPS.map((coreStep, i) => (
              <View
                key={coreStep.key}
                style={[s.progressSegment, i <= progress.index && s.progressSegmentActive]}
              />
            ))}
          </View>
        )}

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isGate ? (
              <DeepDiveGate onboardingName={values.displayName.trim()} />
            ) : isSummary ? (
              <SummaryStep values={values} />
            ) : (
              current.render({ values, set })
            )}
          </ScrollView>
        </Animated.View>

        <View style={s.footer}>
          <TouchableOpacity
            onPress={() => go(Math.max(0, step - 1))}
            disabled={step === 0}
            style={[s.footerBtn, step === 0 && { opacity: 0 }]}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={16} color={colors.foreground} />
            <Text style={s.footerBtnGhostText}>Back</Text>
          </TouchableOpacity>

          {isSummary ? (
            <TouchableOpacity
              onPress={handleDone}
              disabled={isSaving}
              style={[s.footerBtn, s.footerBtnPrimary, isSaving && s.footerBtnDisabled]}
              accessibilityRole="button"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Text style={s.footerBtnPrimaryText}>Start styling</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleNext}
              disabled={!canAdvance}
              style={[s.footerBtn, s.footerBtnPrimary, !canAdvance && s.footerBtnDisabled]}
              accessibilityRole="button"
            >
              <Text style={s.footerBtnPrimaryText}>{isGate ? 'Keep going' : 'Next'}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl },
  loading: { alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: spacing.lg,
  },
  sparkleWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skipText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  eyebrow: {
    ...typography.text.eyebrowLarge,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  // The app's editorial display face makes onboarding part of the same visual system.
  title: {
    ...typography.text.editorialHero,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  desc: {
    ...typography.text.bodySmall,
    color: colors.inkSubtle,
    marginBottom: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radii.full,
    backgroundColor: colors.hairline,
  },
  progressSegmentActive: { backgroundColor: colors.primary },
  scrollContent: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    minHeight: 46,
  },
  footerBtnGhostText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  footerBtnPrimary: { backgroundColor: colors.primary },
  footerBtnPrimaryText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  footerBtnDisabled: { opacity: 0.4 },
});
