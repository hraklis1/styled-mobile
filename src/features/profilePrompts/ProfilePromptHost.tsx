import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { track } from '../../lib/analytics';
import { selectionAsync } from '../../lib/haptics';
import { colors, spacing, typography } from '../../theme';
import type { ProfilePromptKey, ProfilePromptState, ProfilePrompts } from '../../types/profile';
import { PrimaryCTA } from '../../screens/onboarding/components/PrimaryCTA';
import { useOnboardingForm } from '../../screens/onboarding/useOnboardingForm';
import { mayAsk, remainingPrompts } from './gate';
import { PROMPTS } from './prompts';
import { onPromptsDue } from './signals';

/**
 * Asks the questions onboarding v2 deferred, at the moment they matter
 * (docs/onboarding-redesign.md §4). One sheet for the whole app:
 *
 * - In context: screens call `recordPromptSignal`; when a threshold is met
 *   and the gate allows it, the question appears. At most one per app
 *   session — a stylist that keeps asking questions is a form again.
 * - On request: Profile's "Sharpen your stylist" runs every open question in
 *   a row, ignoring back-off, because the user asked.
 */

type Ctx = { askAll: () => void };
const PromptContext = createContext<Ctx>({ askAll: () => {} });
export const useProfilePrompts = () => useContext(PromptContext);

const EMPTY_STATE: ProfilePromptState = { shownAt: null, dismissedAt: null, dismissCount: 0, answeredAt: null };
const WINDOW_HEIGHT = Dimensions.get('window').height;

/**
 * @param listen Whether this host answers in-context triggers. The app-level
 *   host does; the one nested inside the Profile modal (native modals sit
 *   above the root sheet layer, so it needs its own) only serves askAll.
 */
export function ProfilePromptHost({ children, listen = true }: { children: React.ReactNode; listen?: boolean }) {
  const { data: profile } = useProfile();
  const ledger = useUpdateProfile({ silent: true });
  const sheet = useRef<BottomSheetModal>(null);
  const [queue, setQueue] = useState<ProfilePromptKey[]>([]);
  const [mode, setMode] = useState<'context' | 'profile'>('context');
  const askedThisSession = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const current = queue[0];

  const writeLedger = useCallback(
    (key: ProfilePromptKey, patch: Partial<ProfilePromptState>) => {
      const prev = (profileRef.current?.profilePrompts as ProfilePrompts | null | undefined)?.[key] ?? EMPTY_STATE;
      ledger.mutate({ profilePrompts: { [key]: { ...EMPTY_STATE, ...prev, ...patch } } });
    },
    [ledger],
  );

  // In-context triggers.
  useEffect(
    () =>
      !listen ? undefined : onPromptsDue((keys) => {
        const p = profileRef.current;
        if (!p || askedThisSession.current || queue.length) return;
        const key = keys.find((k) => mayAsk(k, p));
        if (!key) return;
        askedThisSession.current = true;
        setMode('context');
        setQueue([key]);
      }),
    [listen, queue.length],
  );

  const askAll = useCallback(() => {
    const p = profileRef.current;
    if (!p) return;
    const keys = remainingPrompts(p);
    if (!keys.length) return;
    setMode('profile');
    setQueue(keys);
  }, []);

  useEffect(() => {
    if (!current) return;
    sheet.current?.present();
    writeLedger(current, { shownAt: new Date().toISOString() });
    track('profile_prompt_shown', { key: current, trigger: mode });
    // writeLedger/mode are read at present time only; re-running on their
    // identity would re-stamp shownAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const advance = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  // Dismiss first, advance once the sheet is gone: presenting the next
  // question into a sheet that's still closing drops it (BottomSheetModal
  // dismiss-before-present pitfall).
  const outcome = useRef<'answered' | 'dismissed' | 'later'>('later');

  const handleDismiss = useCallback(() => {
    if (!current) return;
    if (outcome.current !== 'answered') {
      const prev = (profileRef.current?.profilePrompts as ProfilePrompts | null | undefined)?.[current] ?? EMPTY_STATE;
      writeLedger(current, { dismissedAt: new Date().toISOString(), dismissCount: prev.dismissCount + 1 });
      track('profile_prompt_dismissed', { key: current, trigger: mode });
      // Stepping out of a Profile run ends it; a context ask is one question anyway.
      setQueue([]);
      outcome.current = 'later';
      return;
    }
    outcome.current = 'later';
    advance();
  }, [advance, current, mode, writeLedger]);

  const handleAnswered = useCallback(() => {
    if (!current) return;
    outcome.current = 'answered';
    writeLedger(current, { answeredAt: new Date().toISOString() });
    track('profile_prompt_answered', { key: current, trigger: mode });
    sheet.current?.dismiss();
  }, [current, mode, writeLedger]);

  const value = useMemo(() => ({ askAll }), [askAll]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />,
    [],
  );

  return (
    <PromptContext.Provider value={value}>
      {children}
      <BottomSheetModal
        ref={sheet}
        enableDynamicSizing
        maxDynamicContentSize={WINDOW_HEIGHT * 0.85}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={s.handle}
        backgroundStyle={s.sheetBackground}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {current ? (
          <PromptBody
            key={current}
            promptKey={current}
            step={mode === 'profile' ? { index: 0, remaining: queue.length } : null}
            onSaved={handleAnswered}
            onLater={() => sheet.current?.dismiss()}
          />
        ) : null}
      </BottomSheetModal>
    </PromptContext.Provider>
  );
}

/** Mounted per question so the form hydrates fresh from the latest profile. */
function PromptBody({
  promptKey,
  step,
  onSaved,
  onLater,
}: {
  promptKey: ProfilePromptKey;
  step: { index: number; remaining: number } | null;
  onSaved: () => void;
  onLater: () => void;
}) {
  const insets = useSafeAreaInsets();
  const def = PROMPTS[promptKey];
  const { values, set, savePartial, isSaving } = useOnboardingForm();
  const [error, setError] = useState(false);

  const setWithHaptic: typeof set = (key, value) => {
    void selectionAsync();
    set(key, value);
  };

  const save = async () => {
    setError(false);
    try {
      await savePartial(def.fields);
      onSaved();
    } catch {
      setError(true);
    }
  };

  return (
    <BottomSheetScrollView
      contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.eyebrow}>
        {def.eyebrow}
        {step && step.remaining > 1 ? `  ·  ${step.remaining} left` : ''}
      </Text>
      <Text style={s.title}>{def.title}</Text>
      <Text style={s.sub}>{def.sub}</Text>
      <View style={s.body}>
        <def.Body values={values} set={setWithHaptic} />
      </View>
      {error ? <Text style={s.error}>Couldn't save. Check your connection and try again.</Text> : null}
      <PrimaryCTA label={step && step.remaining > 1 ? 'Save and continue' : 'Save'} onPress={save} loading={isSaving} />
      <Text style={s.later} onPress={onLater} accessibilityRole="button">
        Not now
      </Text>
    </BottomSheetScrollView>
  );
}

const s = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm },
  eyebrow: { ...typography.text.eyebrowLarge, color: colors.primary },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  sub: { ...typography.text.bodySmall, color: colors.inkSubtle },
  body: { marginVertical: spacing.lg },
  error: { ...typography.text.caption, color: colors.destructive ?? colors.foreground, textAlign: 'center' },
  later: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', paddingVertical: spacing.md },
});
