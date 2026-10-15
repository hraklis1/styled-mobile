# Stylist Landing — Polish Plan

Goal: elevate the empty-state landing of the AI stylist with subtle, editorial
touches. No new imagery, no new colours; type, motion and whitespace only.

Scope files:
- `src/components/stylist/ChatEmptyStates.tsx` — `EmptyState`
- `src/components/stylist/stylist-empty-state.ts` — pure copy helpers (+ tests)
- `src/components/stylist/ChatStyles.ts` — `landing*`, `header`, composer styles
- `src/components/stylist/StylistChatView.tsx` — masthead + `<EmptyState>` mount

## Findings from the code (corrections to the first pass)

- **Chip edge fade already exists** (`landingIdeasFade`, 48px). Keep it; only
  widen to ~64px if the clip on "Pack a trip" still reads as hard on device.
- **The masthead already shows `LOCATION · 14° · CLEAR`** on the landing
  (`headerMetaQuiet`). A weather dateline in the hero would duplicate it, so the
  hero eyebrow carries the *date* only.
- **"Refreshing…" blue banner is Expo's dev reload overlay**, not app UI. The
  clipped header icons are a dev-only artefact; no fix needed.
- **The hairline under the header is the shared `header` border.** It is right
  over a thread but reads as stray over an empty canvas.

## Phase 1 — Hero composition

1. **Date eyebrow** above the greeting: `THURSDAY, 15 OCTOBER`, reusing the
   `typography.text.eyebrow` treatment (11/14, tracking 1.4, uppercase,
   `colors.inkSubtle`). New pure helper `landingDateline(date)` in
   `stylist-empty-state.ts`, locale-formatted via `Intl.DateTimeFormat`.
2. **Short hairline rule** between the greeting and the question: 24×1,
   `colors.hairline`, `marginTop: spacing.lg`. Replaces the question's current
   `marginTop` so vertical rhythm is unchanged.
3. **Optical centering.** `landing` uses `justifyContent: 'center'`, which puts
   the block at geometric centre and leaves a dead zone above the composer.
   Add `paddingBottom` ≈ 6% of height (or `justifyContent: 'flex-end'` with a
   bottom gap tied to `air`) so the block sits slightly below centre, nearer the
   composer it leads into. Verify on SE, 15, and 15 Pro Max sizes.
4. **Question colour token.** `landingQuestion` hardcodes `#666`; switch to
   `colors.mutedForeground` (or `inkSubtle`) so it follows the theme.

## Phase 2 — Contextual subline

Replace the static "What are we putting together today?" with a priority
ladder; keep the static line as the fallback.

1. Today's next timed calendar event that needs a look (reuse the calendar
   redesign's "needs a look" rule — all-day events never qualify):
   *"Dinner at 8 tonight. Shall we find the look?"*
2. Weather tier from the existing weather hook (cold / rainy only):
   *"A cold one out there. Let's layer."* / *"Rain's coming. Let's dress for it."*
3. Fallback: *"What are we putting together today?"*

Implement as pure `landingSubline({ nextEvent, weather, now })` in
`stylist-empty-state.ts` with unit tests next to the existing
`stylist-empty-state.test.ts`. Data is passed in from `StylistChatView`
(already has weather; add the calendar query it already uses for event entry).
Never block render on data: render fallback first, crossfade if a contextual
line arrives within ~600ms, otherwise keep the fallback (no late swaps).

## Phase 3 — Entrance motion

Staggered fade-up with Reanimated `entering`:
- eyebrow 0ms → greeting 70ms → rule 140ms → subline 210ms → chips 300ms
- `FadeInDown.duration(520).withInitialValues({ transform: [{ translateY: 6 }] })`
  with a soft ease-out (`Easing.bezier(0.22, 1, 0.36, 1)`).
- Chips enter as one row (not per-chip) to avoid busyness.
- Run once per landing mount only — not on "New styling session" taps within
  ~1s, and not when returning from a sheet.
- Respect `profile.reduceMotion` and the OS setting (`useReducedMotion`):
  plain 200ms opacity fade, no translate.

## Phase 4 — Chips and composer

1. **Glyph tint.** `landingIdeaGlyph` is the same grey as everything else; use
   the warm accent from the theme (check `colors` for the existing taupe/accent
   token — do not add a new one).
2. **Press state.** Chips currently only drop opacity. Add a subtle fill
   (`rgba(0,0,0,0.035)`) on press via `Pressable` style callback; keep haptic.
3. **Composer lift on landing.** Soft shadow (`shadowOpacity 0.04–0.06`,
   `radius 12`, `offset y 4`, Android `elevation 1`), only while `isEmpty`.
   Focus state: border darkens from `rgba(0,0,0,0.08)` to `0.16`; no colour.

## Phase 5 — Canvas and chrome

1. **Hide header hairline on the landing**: `borderBottomWidth: 0` when
   `isEmpty && !entryContext`; restore when the thread has messages (or once
   content scrolls under the header).
2. **Background warmth**: full-bleed `LinearGradient` behind the landing,
   `colors.background` → ~2% darker at the bottom. Must be imperceptible as a
   gradient; delete it if it reads as banding on device.

## Out of scope

- Garment imagery or illustration on the landing (deliberate type-only design).
- Changing starter workflows or their copy.
- Dark mode beyond using tokens (the landing has no dark palette today).

## Verification

- `npm test -- stylist-empty-state` (dateline + subline ladder cases:
  no event/no weather, event today, all-day event ignored, cold, rainy,
  evening after last event).
- `npx tsc --noEmit`.
- Simulator (`npm run ios`), screenshots of: morning/afternoon/evening greeting,
  with and without a calendar event, reduce-motion on, iPhone SE and Pro Max,
  keyboard open (hero must not collide with the lifted composer), and
  New-session from a populated thread (no flicker, no re-stagger spam).

## Order and size

Phases 1, 4, 5 are styling-only and can ship together (~1 short session).
Phase 3 is independent. Phase 2 touches data flow and has the most
test surface; do it last.
