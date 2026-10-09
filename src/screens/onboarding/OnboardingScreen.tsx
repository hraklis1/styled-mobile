import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { track } from '../../lib/analytics';
import { ImpactFeedbackStyle, impactAsync, selectionAsync } from '../../lib/haptics';
import { colors, spacing, typography } from '../../theme';
import { OnboardingShell } from './components/OnboardingShell';
import { PrimaryCTA } from './components/PrimaryCTA';
import { StepTransition } from './components/StepTransition';
import { QUESTIONS, type QuestionKey } from './flow';
import { useOnboardingForm, type OnboardingValues } from './useOnboardingForm';
import { AestheticStep } from './v2/AestheticStep';
import { ClimateStep } from './v2/ClimateStep';
import { CutStep } from './v2/CutStep';
import { OccasionStep } from './v2/OccasionStep';
import { RevealStep } from './v2/RevealStep';
import type { StepProps } from './v2/types';
import { useRevealQuery } from './useRevealQuery';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { useStylingWeatherToday } from '../../hooks/useWeather';
import { WelcomeStep } from './v2/WelcomeStep';

/**
 * Onboarding v2 (docs/onboarding-redesign.md): an editorial welcome, then
 * four one-decision screens. Everything else — budget, sizes, fit, avoids —
 * is asked later, at the moment it changes what the user sees.
 *
 * Answers checkpoint on every advance (see `useOnboardingForm`), so the flow
 * is safe to abandon and to re-enter; Skip saves what was answered.
 *
 * @param showWelcome False for a retake from Account: they've met us.
 * @param onWelcomeSeen Persists that the welcome was shown.
 * @param onExit Called once the profile has actually saved. See AppGate's latch.
 *   `next: 'addClothes'` asks the app to open the photo picker once it mounts.
 */
export function OnboardingScreen({
  showWelcome = false,
  onWelcomeSeen,
  onExit,
}: {
  showWelcome?: boolean;
  onWelcomeSeen?: () => void;
  onExit: (next?: 'addClothes') => void;
}) {
  const { values, set, isLoading, isSaving, saveCheckpoint, finish } = useOnboardingForm();
  const [welcome, setWelcome] = useState(showWelcome);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set once Finish has saved: the reveal reads the answers server-side.
  const [revealing, setRevealing] = useState(false);
  const { activeLocation } = useActiveStylingLocation();
  const weather = useStylingWeatherToday(activeLocation);
  const reveal = useRevealQuery(revealing && !weather.isLoading, {
    temperatureC: weather.data?.current.temperatureC,
    condition: weather.data?.current.condition,
  });

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const blocker = current.blocker(values);

  // Per-screen funnel (phase 0 events, now tagged v2).
  const viewedAt = useRef(Date.now());
  const viewedKey = welcome ? 'welcome' : revealing ? 'reveal' : current.key;
  useEffect(() => {
    if (isLoading) return;
    viewedAt.current = Date.now();
    track('onboarding_step_viewed', { step: viewedKey, index: welcome ? -1 : step, version: 2 });
  }, [isLoading, viewedKey, welcome, step]);

  const revealStartedAt = useRef(0);
  useEffect(() => {
    if (revealing) revealStartedAt.current = Date.now();
  }, [revealing]);
  useEffect(() => {
    if (!reveal.data && !reveal.isError) return;
    track('onboarding_reveal_shown', {
      latencyMs: Date.now() - revealStartedAt.current,
      source: reveal.data?.source ?? 'error',
    });
  }, [reveal.data, reveal.isError]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const go = (next: number) => {
    setDirection(next < step ? 'back' : 'forward');
    setStep(next);
  };

  // A tick on every choice; the shared primitives stay haptics-free.
  const setWithHaptic: StepProps['set'] = (key, value) => {
    void selectionAsync();
    set(key, value);
  };

  const handleBegin = () => {
    track('onboarding_step_completed', { step: 'welcome', index: -1, version: 2, msOnStep: Date.now() - viewedAt.current });
    onWelcomeSeen?.();
    setDirection('forward');
    setWelcome(false);
  };

  // `patch` carries an answer made in the same tick, which `values` won't hold yet.
  const handleNext = (patch?: Partial<OnboardingValues>) => {
    track('onboarding_step_completed', {
      step: current.key,
      index: step,
      version: 2,
      msOnStep: Date.now() - viewedAt.current,
      styles: values.stylePreference.length,
      occasions: values.occasionPicks.length,
      paletteTouched: values.paletteTouched,
      hasLocation: !!values.location.trim(),
    });

    if (isLast) {
      track('onboarding_completed', { skipped: false, version: 2 });
      finish(() => setRevealing(true));
      return;
    }
    void impactAsync(ImpactFeedbackStyle.Light);
    saveCheckpoint(patch);
    go(step + 1);
  };

  // One-tap steps: let the selection register visibly, then move on.
  const handleAutoAdvance = (patch: Partial<OnboardingValues>) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => handleNext(patch), 260);
  };

  const handleBack = () => go(Math.max(0, step - 1));

  const handleSkip = () => {
    track('onboarding_completed', { skipped: true, atStep: current.key, version: 2 });
    finish(onExit);
  };

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (revealing) {
    const leave = (choice: 'scan' | 'explore') => {
      track('onboarding_cta', { choice, revealSource: reveal.data?.source ?? 'none' });
      onExit(choice === 'scan' ? 'addClothes' : undefined);
    };
    return (
      <RevealStep
        name={values.displayName.trim()}
        stylePreference={values.stylePreference}
        place={activeLocation.label ?? (values.location.trim() || null)}
        reveal={reveal.data}
        failed={reveal.isError}
        onAddClothes={() => leave('scan')}
        onExplore={() => leave('explore')}
      />
    );
  }

  if (welcome) {
    return (
      <Animated.View style={s.fill} entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}>
        <WelcomeStep onBegin={handleBegin} />
      </Animated.View>
    );
  }

  const body = (key: QuestionKey) => {
    const props = { values, set: setWithHaptic };
    switch (key) {
      case 'cut':
        return <CutStep {...props} onPicked={handleAutoAdvance} />;
      case 'aesthetic':
        return <AestheticStep {...props} />;
      case 'occasions':
        return <OccasionStep {...props} />;
      case 'climate':
        return <ClimateStep {...props} />;
    }
  };

  return (
    <OnboardingShell
      progress={{ index: step, total: QUESTIONS.length }}
      onBack={step > 0 ? handleBack : undefined}
      onSkip={isSaving ? undefined : handleSkip}
      footer={
        <PrimaryCTA
          label={current.cta(values)}
          disabledLabel={blocker}
          disabled={!!blocker}
          loading={isSaving}
          onPress={() => handleNext()}
        />
      }
    >
      <StepTransition stepKey={current.key} direction={direction}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.eyebrow}>{current.eyebrow}</Text>
          <Text style={s.title} accessibilityRole="header">
            {current.title}
          </Text>
          {current.desc ? <Text style={s.desc}>{current.desc}</Text> : null}
          <View style={s.stepBody}>{body(current.key)}</View>
        </ScrollView>
      </StepTransition>
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  eyebrow: {
    ...typography.text.eyebrowLarge,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.text.editorialHero,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  desc: {
    ...typography.text.bodySmall,
    color: colors.inkSubtle,
  },
  stepBody: { marginTop: spacing.xl },
  scrollContent: { paddingBottom: spacing.xl },
});
