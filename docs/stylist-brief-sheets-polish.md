# Stylist Brief Sheets — Polish Plan

Goal: make the guided briefs ("Dress for a plan", "Style a piece", "Pack a
trip", "Build my wardrobe") feel like part of the editorial stylist landing
(serif voice, hairline rules, tracked small caps, lots of space) rather than a
settings form. **Pill grids stay**; they get refined, not replaced.

Scope:
- `src/components/stylist/StylistIntakeSheet.tsx` — the only sheet; all four kinds
- `src/features/stylist/workflows.ts` — validation copy only (no contract change)
- `src/theme/index.ts` — read-only; reuse existing tokens (`stroke`, `motion`,
  `editorialItalic`, `masthead`, `hairline`, `ghostStroke`, `stitch`)
- `src/lib/haptics.ts` — the existing wrapper

No backend change. The `StylistWorkflow` payload stays byte-identical
(including `luggage: 'not_sure'` when nothing is picked).

## Diagnosis (from the sim screenshots)

1. Two visual languages: editorial landing vs. stock form sheet (bold sans
   labels, white bordered boxes on cream).
2. "OPTIONAL" repeated 3–4× per sheet; noise that marks the common case.
3. Chips: 44pt tall, white fill, the same weight as inputs, so the sheet reads
   as a grid of boxes. Wraps leave orphans ("Formal / Not sure", "Bold").
4. The solid-black "Not sure" luggage default is the loudest element on the
   trip sheet, yet the user never chose it.
5. Footer: a grey slab plus "Complete the required fields." reads like an
   error before the user has touched anything.
6. Header: the reassurance subtitle is filler; the filled grey close disc
   outweighs the title.

## Phase 1 — Header

- Keep `YOUR BRIEF` but switch to `typography.text.masthead` in `inkSubtle`
  (matches `LONDON · 14°C` on the landing).
- Title stays `editorialSheet` serif.
- Add the landing's short rule under the title: 24×`stroke.hairline`,
  `colors.hairline`, `marginTop: spacing.md`.
- Replace "Nothing is sent until you finish this brief." with a per-kind
  italic serif prompt (`editorialItalic`, `mutedForeground`) via a new
  `promptForKind()`:
  - occasion: *"Tell me where you're going."*
  - style_piece: *"Pick a piece and I'll build around it."*
  - trip: *"Where to, and for how long?"*
  - wardrobe_build: *"Tell me how you live, and I'll fill the gaps."*
- Close: bare `close` glyph (18pt, `inkSubtle`), 44×44 hit area kept, no fill.

## Phase 2 — Labels & rhythm

- `FieldLabel` becomes a tracked small-caps label (`typography.text.eyebrow`,
  `inkSubtle`). Delete the `OPTIONAL` tag entirely.
- Required fields are not labelled as required; the disabled CTA plus the
  Phase 6 nudge does that job.
- Field gap: `spacing.xl` → `spacing.subsection` (32) between fields;
  label→control `spacing.md`.
- Horizontal padding to `spacing.page` (24) to match the landing.

## Phase 3 — Text inputs

- Drop the white box: transparent background, no side/top border, one
  `stroke.hairline` underline in `colors.hairline`. Underline darkens to
  `colors.foreground` while focused (track focus per field).
- Primary inputs (plan, destination) are set in serif
  (`editorialBody`, ~19pt) so the answer reads as written, not typed.
  Secondary inputs (occasion, plans) use `body`.
- "Anything else?" starts as a single underlined line and grows
  (`multiline`, `minHeight` one line, `maxHeight` ~4 lines, scrolls after).
- Placeholders stay; colour `mutedForeground`.

## Phase 4 — Pills (refined, still grids)

- **Lighter resting state:** transparent fill, 1pt `ghostStroke` outline,
  `foreground` text at regular weight. No more white tiles on cream.
- **Smaller and denser:** visual height 36pt (`borderRadius: 18`,
  `paddingHorizontal: spacing.lg`) with `hitSlop` top/bottom 4 so the target
  stays at 44pt. Gap `spacing.sm`.
- **Selected:** `primary` fill, `primaryForeground` text, *same weight*
  (medium for both states) so the label width doesn't jump on selection.
  Optional leading `checkmark` 12pt only on multi-select groups
  (wardrobe_build) to tell multi from single.
- **Press feedback:** `Pressable` with scale 0.97 + opacity 0.85 on press,
  `motion.quick`; fill cross-fades over `motion.quick` using Reanimated
  `withTiming` on background/border colour. `Haptics.selectionAsync()` on
  every toggle.
- **No orphans / balance:**
  - Remove `Not sure` from `DRESS_CODES`; nothing selected already means
    "no dress code".
  - Reorder so rows break naturally at 393pt width:
    - Dress code: `Casual · Smart casual · Business` / `Cocktail · Formal`
      (labels unchanged, so the backend sees the same vocabulary)
    - Feel: `Relaxed · Comfortable · Polished` / `Confident · Bold`
    - Direction: `Everyday · More casual · More polished` /
      `More formal · Unexpected`
  - Verify wraps on SE (375) and Pro Max (440); if a single pill orphans,
    accept it rather than adding layout logic.
- **Luggage:** render only `Carry-on only` and `Checked bag`; nothing
  selected by default. State default stays `'not_sure'` and deselecting
  returns to it, so the payload is unchanged.
- Single-select groups keep tap-again-to-clear.

## Phase 5 — Special controls

- **Style a piece — piece slot.** Replace the row with a hero slot:
  - Empty: 88×110 dashed `stitch` frame (radius `radii.md`) with a `shirt`
    glyph, beside serif `Choose from your closet` + caption
    `Tap to browse your pieces`.
  - Filled: the item's cutout on `imageMat` in the same frame (expo-image,
    `contentFit="contain"`), serif item name, caption with category · colour,
    and a quiet underlined `Change` text action.
  - When opened from an item (`initialItemId`), it arrives filled.
- **Pack a trip — dates.** One `DATES` field: an underlined row reading
  `Departure  →  Return` (placeholders in `mutedForeground`), each half
  tappable to its own picker. When both are set, show
  `Thu 12 Nov → Wed 18 Nov` plus a caption `6 nights`
  (new pure helper `tripSpanLabel(start, end)` in `workflows.ts`, unit
  tested). Drop the two calendar icons.

## Phase 6 — Footer & validation

- Remove the helper/validation line above the button.
- CTA keeps its shape always: `primary` fill, radius `radii.lg`, 54pt,
  `sparkles` icon. Disabled = opacity 0.35 (not grey), animated over
  `motion.base` when it becomes valid.
- Footer hairline border removed; instead a 24pt top fade from transparent
  to `background` over the scroll content so fields slide under it.
- Tapping while disabled: keep the button `disabled={false}` visually
  dimmed, and on press scroll to the first missing field, briefly darken
  its underline/frame to `foreground` and pulse it (scale 1→1.02→1 over
  `motion.slow`), plus `Haptics.notificationAsync(Warning)`. Announce
  `validationError` via `AccessibilityInfo.announceForAccessibility`.
- `accessibilityState.disabled` still reflects validity; `accessibilityHint`
  carries the missing-field message.

## Phase 7 — Motion

- Sheet entry: content fields fade + translate up 8pt with a 40ms stagger
  (Reanimated `FadeInDown.delay(i*40).duration(motion.base)`), header first.
- Respect Reduce Motion (`useReducedMotion()`): skip stagger and pill scale.

## Out of scope

- Brief vocabulary changes that the backend would see.
- Moving to a native form sheet / detents.
- The landing chips rail (already polished in `stylist-landing-polish.md`).

## Verification

1. `npx tsc --noEmit` and the workflows unit tests (new `tripSpanLabel` cases:
   same day, 1 night, month boundary, missing end).
2. Sim (`npm run ios`): open each of the 4 briefs from the landing chips;
   screenshot empty and filled states.
3. Check: no `OPTIONAL` text; luggage starts unselected and submits
   `not_sure`; piece slot shows cutout; date span caption; disabled CTA nudge
   scrolls to the missing field; keyboard doesn't cover the focused field.
4. iPhone SE + Pro Max widths for pill wrapping; Reduce Motion on.
5. VoiceOver pass: labels read as "Dress code", pills announce selected state,
   CTA hint names the missing field.
