import type { OnboardingValues } from './useOnboardingForm';
import { AESTHETIC_MIN, visibleAesthetics } from './v2/AestheticStep';

/**
 * Onboarding v2's question screens, in order (docs/onboarding-redesign.md §3).
 * Welcome sits before these and the reveal after; neither counts toward
 * progress. Everything else the stylist could use is asked later, in context.
 */
export type QuestionKey = 'cut' | 'aesthetic' | 'occasions' | 'climate';

export type QuestionDef = {
  key: QuestionKey;
  eyebrow: string;
  title: string;
  desc?: string;
  /** Why the CTA is disabled, in words; undefined means the step can advance. */
  blocker: (v: OnboardingValues) => string | undefined;
  /** CTA label once answerable. */
  cta: (v: OnboardingValues) => string;
  /** Answering the step advances by itself (one-tap steps). */
  autoAdvance?: boolean;
};

export const QUESTIONS: QuestionDef[] = [
  {
    key: 'cut',
    eyebrow: 'THE CUT',
    title: 'Which collections do you shop?',
    blocker: (v) => (v.fitPreference ? undefined : 'Choose one'),
    cta: () => 'Continue',
    autoAdvance: true,
  },
  {
    key: 'aesthetic',
    eyebrow: 'YOUR EYE',
    title: 'What do you keep coming back to?',
    desc: 'Pick two to four, favourite first.',
    blocker: (v) => {
      const missing = AESTHETIC_MIN - visibleAesthetics(v.stylePreference).length;
      if (missing <= 0) return undefined;
      return missing === AESTHETIC_MIN ? `Pick ${AESTHETIC_MIN} or more` : `Pick ${missing} more`;
    },
    cta: () => 'Continue',
  },
  {
    key: 'occasions',
    eyebrow: 'YOUR WEEK',
    title: 'Where does your week take you?',
    desc: 'Up to three. We build these outfits first.',
    blocker: (v) => (v.occasionPicks.length ? undefined : 'Pick at least one'),
    cta: () => 'Continue',
  },
  {
    key: 'climate',
    eyebrow: 'WHERE YOU ARE',
    title: "Dress for the weather you're in.",
    blocker: () => undefined,
    cta: () => 'Finish',
  },
];
