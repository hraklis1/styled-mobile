# Onboarding Redesign — Plan

Status: all phases (0–6) implemented and sim-verified, uncommitted · 2026-10-09 · mobile + `../Styled` backend. See §11 for what shipped differently from the plan.

## 1. Goal

Get a new user from install to a first personalised look in **under 60 seconds and
4 required decisions**, in a flow that reads like an editorial magazine rather than
a form. Everything else is learned later, at the moment it matters.

Success metrics (PostHog, already wired through `track()`):

| Metric | Today (to baseline) | Target |
|---|---|---|
| Welcome → onboarding_completed | measure first | +25% relative |
| Median time in flow | measure first | < 60 s |
| Drop-off on any single screen | measure first | < 8% |
| Users with a "first look" viewed on day 1 | 0 (doesn't exist) | > 70% |
| Profile completeness at day 7 (deferred fields) | n/a | > 50% |

**Step 0 before any UI work:** add `onboarding_step_viewed` to the current flow and
ship it, so we have a real per-screen funnel to compare against.

---

## 2. What changes, in one table

| Field | Today | New |
|---|---|---|
| Welcome carousel (3 slides) | before quiz | **1** full-bleed screen |
| `displayName` | required text input, screen 1 | **prefilled** from auth `full_name`; editable inline on the reveal screen |
| `fitPreference` (cut) | required | **required** — screen 1 |
| `stylePreference` | required, 11 text cards | **required** — image cards, 2–4 picks |
| `occasions` | required, 13 pills | **required** — 7 options, pick up to 3 |
| `location` + permission | required screen w/ 4 inputs | **required-ish** — single "climate" screen, permission OR city, skippable |
| `sizingRegion` | required | **inferred** from device locale; editable later |
| `colorPalette` | required | **optional** on the style screen ("refine", collapsed) → default from aesthetics |
| `budgetRange` | required | **deferred** → asked on first Shop / guide open |
| `bodyType` | required | **deferred** → "Sharpen your stylist" card |
| `fitSilhouette` | required | **deferred** → same card |
| `sizeTop/Bottom/Shoe/Dress` | top required-ish, rest optional | **deferred** → first Shop open / first size-dependent recommendation |
| `styleAvoids`, `avoidedColors` | optional | **deferred** + learned passively from "Not for me" |
| `shoppingPriorities`, `retailers` | optional | **deferred** → Shop |
| Summary screen | list of answers | replaced by **Reveal** screen (first look + style read) |

---

## 3. The new flow

Six screens total, four with an input. Progress is shown only across the four input
screens. Every screen has one decision, fits without scrolling on an iPhone SE
height, and has a thumb-zone primary button.

### Screen 0 — Welcome (replaces the 3-slide carousel)

- **Visual:** a full-bleed editorial photograph with a slow Ken Burns pan (8 s, scale
  1.0 → 1.06, Reanimated) and a bottom gradient into ivory.
- **Copy:** Wordmark. Headline in Newsreader display: *"Your wardrobe, edited."*
  Sub: *"Tell us four things. We'll style the rest."*
- **Actions:** primary `Begin` · tertiary `I've been here before` (signs in, if
  relevant to the auth flow).
- **Why:** the feature carousel took three taps and sold features the user hasn't
  felt yet. The reveal at the end does that job better.

### Screen 1 — Cut  · `1 / 4`

- **Eyebrow:** `THE CUT` · **Title:** *"Which collections do you shop?"*
- **Input:** three tall cards stacked vertically (not pills), each with a garment-only
  image: Menswear · Womenswear · Both / fluid. One tap **selects and advances**
  (no Next button) after a 250 ms confirm beat: card scales to 0.98, check fades in,
  light haptic.
- **Micro-copy under cards:** *"Sets sizes and shapes. Change it anytime."*
- **Why first:** gates the option lists on every later screen (`optionsForCut`) and
  the shopping department guardrail. It is also the least effort to answer.

### Screen 2 — Aesthetic  · `2 / 4`

- **Eyebrow:** `YOUR EYE` · **Title:** *"What do you keep coming back to?"*
- **Input:** a 2-column grid of portrait image cards (3:4), the label set in
  Newsreader italic over a soft bottom scrim. Pick 2–4. Options filtered by cut.
  Reduce to **8** options: Minimalist, Classic, Relaxed (was Casual), Tailored
  (was Smart casual), Street, Romantic (was Bohemian), Edgy, Vintage. Trend-forward,
  Preppy and Athleisure stay valid stored values and remain editable in Profile, but
  are not shown in onboarding.
- **Selection feel:** selected cards get a 1.5 px ink border and a numbered badge
  (1, 2, 3) in pick order. Order is stored and used as a weight. Unselected cards
  dim to 85% once 4 are picked, and a fifth tap shakes the badge row instead of
  silently failing.
- **Progressive disclosure:** under the grid, a quiet row `Refine colours ›` expands
  the existing palette swatches in place. Untouched → palette is derived (§5.3).
- **CTA:** `Continue` enables at 2 picks; below 2 its label reads `Pick 2 or more`
  rather than going grey without explanation.

### Screen 3 — Occasions  · `3 / 4`

- **Eyebrow:** `YOUR WEEK` · **Title:** *"Where does your week take you?"*
- **Input:** 7 large rows with line icons, pick up to 3:
  Work · Weekends · Evenings out · Events & weddings · Active · Travel · Campus.
  Each maps to existing stored values (see §5.2). Rows animate in staggered
  (40 ms apart, 12 px rise + fade).
- **Why fewer:** the current 13 overlap (everyday/weekend, date night/night out,
  travel/vacation, and "smart casual" which is a style, not an occasion).

### Screen 4 — Climate  · `4 / 4`

- **Eyebrow:** `WHERE YOU ARE` · **Title:** *"Dress for the weather you're in."*
- **Visual:** a live-ish forecast card placeholder (a temperature and icon that fill
  in once location resolves). This makes the value of the permission visible
  *before* the OS prompt.
- **Input:** primary `Use my location` → system prompt. Secondary text link
  `Enter a city instead` → the existing `LocationAutocompleteInput` slides up.
  Tertiary `Skip` — weather styling just falls back to season.
- **Inferred here, silently:** `sizingRegion` from locale (§5.4).

### Screen 5 — Reveal (the payoff)

- **Transition in:** a 1.2–2 s "composing" moment, an editorial loading state, not a
  spinner: the user's picked aesthetic images collapse into a single stack, with
  copy cycling *"Reading your eye…" → "Checking the weather in Lisbon…"*. It is
  backed by a real request, so it is not fake delay. If the request returns faster,
  hold to a minimum of 900 ms so the beat lands.
- **Content:**
  1. *"Good to meet you, Alex."* (name editable inline with a pencil glyph)
  2. **Your style read** — a 2-line editorial summary generated from answers,
     e.g. *"Quiet minimalism with a tailored edge. Neutrals, clean lines, built for
     the office and evenings out."*
  3. **A first look for today** — 3–4 piece collage built from the curated catalog
     (the closet is empty), weather-aware. Uses the existing guide / CuratedItemCard
     surface.
- **CTA:** primary `Start my wardrobe` → opens the scan flow (the single most
  important day-1 action). Secondary `Explore first` → home.
- **Why:** today the flow ends on a list of the user's own answers. The reveal proves
  the answers were heard and drives the first scan.

---

## 4. Deferred capture — "progressive profiling"

Each deferred question is asked **once, in context, at the moment its answer
changes what the user sees**, using a bottom sheet with the same visual language as
onboarding. Every prompt is dismissible and records the dismissal so it is not
re-asked for 14 days (max 2 dismissals, then only from Profile).

| Question | Trigger | Sheet copy |
|---|---|---|
| Budget tiers | first open of Shop tab or a shopping guide | *"So we show things you'd actually buy."* |
| Sizes (top / bottom / shoe / dress) | first product detail with a size, or first Shop open after budget | *"Only used to keep picks wearable. Private."* |
| Shops you love | after 3 product views | *"Where should we look first?"* |
| Silhouette + proportions | after the 5th stylist request, or from the profile card | *"Two quick ones that sharpen fit advice."* |
| Avoids / colours to avoid | after the 2nd "Not for me" tap, prefilled from the taste profile | *"We noticed you skip these. Never show them?"* |

Plus a persistent **"Sharpen your stylist"** card at the top of the profile hub with
a completeness ring (e.g. *"62% — 3 quick questions left"*). Tapping it runs the
remaining deferred questions as a short mini-flow that reuses the onboarding shell.

---

## 5. Data & schema

### 5.1 New columns / fields (backend `../Styled`, migration `0066`)

```sql
-- 0066_onboarding_v2.sql
-- (profile data lives on the users table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_version smallint NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_prompts jsonb NOT NULL DEFAULT '{}'::jsonb;
-- profile_prompts: { [promptKey]: { shownAt, dismissedAt?, dismissCount, answeredAt? } }
```

- `onboarding_version` — `2` for users through the new flow. Lets analytics and the
  stylist distinguish "never asked" from "skipped" for body type, budget and the
  other deferred fields.
- `profile_prompts` — the dismissal/answered ledger for §4. A JSON column on profile,
  not a table: it is small, per-user, and always read with the profile.
- `stylePreference` stays `text[]`; **order is now meaningful** (pick order = weight).
  No schema change, but document it in `shared/schema.ts` and have the stylist
  prompt builder weight the first entry.
- Apply with `scripts/apply-migration.ts`, dev first, then prod (`--prod`). Never
  `db:push` in `../Styled`.

### 5.2 Option vocabulary (`src/lib/profileOptions.ts`)

- Add `ONBOARDING_STYLE_OPTIONS` (8, with `image` keys) and
  `ONBOARDING_OCCASION_OPTIONS` (7). Each onboarding occasion maps to **existing**
  stored values, so no data migration and no backend vocabulary change:

  | Onboarding | Stored values |
  |---|---|
  | Work | `work_office` |
  | Weekends | `everyday`, `casual_weekend` |
  | Evenings out | `date_night`, `night_out` |
  | Events & weddings | `formal_events`, `wedding_guest` |
  | Active | `athletic_active` |
  | Travel | `travel`, `vacation` |
  | Campus | `school` |

- Remove `smart_casual` from the onboarding occasion list (it is a style). Leave it
  valid in normalizers for existing data.
- Style relabels are **label-only** (`casual` → "Relaxed", `smart_casual` →
  "Tailored", `bohemian` → "Romantic", `streetwear` → "Street"). Stored values are
  unchanged.
- Budget labels: format with the locale currency symbol instead of hard-coded `$`.

### 5.3 Smart defaults

- **Palette** (if untouched): derived from aesthetics. minimalist/classic/tailored →
  neutral + monochrome; romantic/vintage → earthy + pastels; edgy/street →
  monochrome; relaxed → neutral + earthy. Store with a marker
  `styleProfileDetails.paletteSource = 'derived'`, so it is never shown back to the
  user as "you said".
- **Sizing region:** from locale.
- **Name:** from auth `full_name` (Apple / Google). The email-prefix fallback in
  `AuthContext` is **not** used as a name. Show the greeting without a name instead.

### 5.4 Locale

`expo-localization` is not installed. Use `Intl.DateTimeFormat().resolvedOptions()`
(Hermes supports it) for region and currency: GB → UK; EU members → EU; else US.
Avoids a native rebuild. Read the v56 docs before adding the package if Intl proves
insufficient.

### 5.5 Reveal endpoint

`POST /api/onboarding/reveal` → `{ styleRead: string, look: CuratedItem[], weather? }`

- `styleRead`: knowledge-route LLM call (the cheap route), answers only, wardrobe-free.
  Cacheable by answer-set hash across users, since it contains no wardrobe data. Add
  its strict JSON schema in `routes.ts` alongside the type and the prompt (all three
  edits, or every call fails).
- `look`: existing curated catalog + the cut-aware shopping department filter +
  weather tier. No commerce-provider call on this path (latency + cost); catalog only.
- Metered as free (onboarding must not burn credits). Timeout of 6 s → fall back to
  a static per-aesthetic style read and hide the look card.

### 5.6 Single source of truth for completion

`AuthContext` maps `user_metadata.onboarding_complete`, but `AppGate` reads
`profile.onboardingComplete`. Confirm nothing reads the auth copy for gating. Then
drop it from `AuthContext`, or mark it deprecated, so the two cannot drift.

### 5.7 Backend tolerance audit (blocking)

Body type, silhouette, budget and sizes go from "always present" to "often null" for
new users. Before shipping, grep every consumer (stylist prompt builders, shopping
brief, guide generation, weather tiering, `optionsForCut`) and confirm null →
sensible default, not "undefined" in a prompt or an empty filter. Add a stylist eval
case with a v2-minimal profile.

---

## 6. Visual & motion system

Everything uses existing theme tokens (`colors`, `typography.text.editorialHero`,
Newsreader). New tokens are added to the theme, not inlined.

- **Layout:** generous top whitespace; eyebrow (letter-spaced caps, `primary`), then
  display title, then at most one line of sub-copy. No hint text under every field.
  Remove the sparkle-in-a-box header badge; the header is just a hairline progress
  bar and `Skip`.
- **Progress:** a single 2 px hairline across the top that **animates its width**
  (spring, damping 20) instead of six segments. Step counter `2 / 4` in tabular
  figures at the right.
- **Screen transitions:** shared-axis horizontal (outgoing slides −24 px + fades,
  incoming from +24 px), 280 ms, `Easing.out(Easing.cubic)`, Reanimated, on the UI
  thread. Back reverses direction. Replaces the 120 ms opacity blink.
- **Haptics (`expo-haptics`, installed):** `selectionAsync` on every toggle;
  `impactAsync(Light)` on auto-advance; `notificationAsync(Success)` when the reveal
  lands. Respect the reduce-motion setting: no Ken Burns, cross-fades only.
- **Cards:** `borderCurve: 'continuous'`, radius `lg`; selected state = ink border +
  badge, never a colour fill (fills read "app", borders read "editorial").
- **Buttons:** full-width primary pinned to the bottom safe area, 52 pt, ink fill,
  ivory text. The Back button becomes a chevron in the header (frees the footer for
  one action).
- **Images:** `expo-image` with `transition={200}` and a blurhash placeholder so
  nothing pops in.
- **Accessibility:** every image card has an `accessibilityLabel` of the label +
  description; selected state through `accessibilityState`; Dynamic Type up to XL
  without clipping (titles wrap; the grid becomes 1 column at the largest sizes).

---

## 7. Imagery

**Source: Pexels, same process as `assets/onboarding/ATTRIBUTION.md`.** Claude
sources the images during implementation; no action is needed from the user. The
existing rules still hold: no identifiable people, no brand marks, a warm neutral
palette. Every file gets a row in `ATTRIBUTION.md` before it is committed.

Needed: 1 welcome hero, 3 cut cards, 8 aesthetic cards ≈ **12 images**, each
downscaled to 900 px on the long edge at JPEG q72 (~1.3 MB added to the bundle).

Aesthetics without people is the hard constraint: each card is a still life, a
flat lay or a garment-on-hanger that carries the mood (minimalist = a white shirt on
a pale wall; edgy = a black leather jacket on concrete; romantic = draped floral
silk; and so on). This is achievable on Pexels and fits the existing
"garments, textiles, racks" art direction.

**Fallback** if a category has no good match: generate it with the existing fal
text-to-image pipeline (we own the output; no licence to track). Record it in
`ATTRIBUTION.md` as "generated, fal / <model>, <date>". If neither yields something
good, the card degrades to a typographic card (the label set large on a palette
swatch), and that card simply ships without an image.

---

## 8. Code plan

### 8.1 Target structure

```
src/screens/onboarding/
  OnboardingScreen.tsx        // shell: header, progress, transitions, footer (slimmed)
  flow.ts                     // STEP config: key, required, validate, autoAdvance
  useOnboardingForm.ts        // + derive defaults, + onboardingVersion: 2
  useRevealQuery.ts           // react-query for /api/onboarding/reveal
  components/
    OnboardingShell.tsx       // safe area, hairline progress, chevron back, skip
    StepTransition.tsx        // Reanimated shared-axis wrapper
    ImageChoiceCard.tsx       // portrait image card w/ order badge
    ChoiceRow.tsx             // icon row for occasions
    PrimaryCTA.tsx            // pinned button with explanatory disabled label
  steps/
    WelcomeStep.tsx           // replaces WelcomeScreen.tsx
    CutStep.tsx
    AestheticStep.tsx         // + collapsible palette (reuses SelectionGroup swatch)
    OccasionStep.tsx
    ClimateStep.tsx           // reuses useActiveStylingLocation + LocationAutocompleteInput
    RevealStep.tsx
src/features/profilePrompts/
  usePromptGate.ts            // shouldAsk(key) / markShown / markDismissed / markAnswered
  PromptSheet.tsx             // bottom sheet shell, onboarding styling
  prompts/BudgetPrompt.tsx, SizesPrompt.tsx, FitPrompt.tsx, AvoidsPrompt.tsx, RetailersPrompt.tsx
src/components/profile/SharpenStylistCard.tsx
```

`DeepDiveSteps.tsx` content moves into the `prompts/` sheets, because the field UIs
(TagField, sizes by region) are reused as-is. `Interstitials.tsx` is deleted.

### 8.2 What stays untouched

- The hydrate-once + checkpoint-every-step + Skip-saves behaviour in
  `useOnboardingForm`.
- The `AppGate` latch. Completion still flips at the last input screen (Climate →
  Reveal), so the reveal is "inside" the flow, exactly as the gate is today.
- `SelectionGroup` (used for the palette and in prompt sheets).
- "Retake style quiz" in `AccountScreen`. It reopens the new flow, prefilled.

### 8.3 `AppGate` changes

- Merge Welcome into the onboarding flow as step 0, and drop the separate
  `welcome_seen` AsyncStorage branch. Existing users already past welcome are
  unaffected, because the gate keys off `onboardingComplete`.
- Retakes skip step 0 and the reveal's "composing" beat (start at Cut).

### 8.4 Analytics

`onboarding_step_viewed {step, version}`, `onboarding_step_completed {step,
ms_on_step, picks}`, `onboarding_reveal_shown {latency_ms, fallback}`,
`onboarding_cta {choice: scan|explore}`, `profile_prompt_{shown,answered,dismissed}
{key, trigger}`.

---

## 9. Phases

Each phase is shippable on its own and sim-verified before the next starts.

| Phase | Scope | Repos | Size |
|---|---|---|---|
| **0 — Baseline** | `onboarding_step_viewed` on the current flow; ship in the next build | mobile | S |
| **1 — Data** | migration 0066; `profileOptions` onboarding vocab + occasion mapping + locale currency; `Intl` region inference; palette derivation; null-tolerance audit (§5.7) + eval case | both | M |
| **2 — Shell & motion** | `OnboardingShell`, `StepTransition`, `PrimaryCTA`, hairline progress, haptics, reduce-motion | mobile | M |
| **3 — New steps** | Welcome, Cut, Aesthetic (+ imagery sourcing & ATTRIBUTION), Occasions, Climate; `flow.ts`; remove old core/deep-dive steps from the flow | mobile | L |
| **4 — Reveal** | `/api/onboarding/reveal` + schema + cache + fallback; `RevealStep`; scan / explore CTAs | both | M |
| **5 — Progressive profiling** | `profile_prompts` gate, `PromptSheet` + 5 prompts wired to their triggers, `SharpenStylistCard` + completeness ring, "Not for me" → avoids suggestion | both | L |
| **6 — Cleanup** | delete `WelcomeScreen`, `Interstitials`, `welcome_seen`; resolve `AuthContext` duplicate flag; update the onboarding memory notes | mobile | S |

Deploy order for 1 and 4: migration dev → prod, then backend deploy, then the mobile
build. Old clients keep working, because every new column has a default and no
existing field changes shape.

## 10. Open questions

1. Reveal's first look comes from the curated catalog. Is any brand or merchant
   exposure on the onboarding screen a concern?
2. Should `Start my wardrobe` go straight into the camera, or into the batch-import
   picker (camera roll)? Recommendation: the picker, since more people have photos of
   their clothes than their clothes in front of them at signup.
3. Does a phase-0 A/B make sense (old vs. new flow behind a flag), or does a
   before/after funnel comparison suffice at current volume?

## 11. As built (2026-10-09)

Where the implementation differs from the plan above, and why.

- **Reveal look is a written line sheet, not product images.** The curated
  catalog has no imagery, and a commerce search would add seconds and cost to
  the payoff screen. The card shows the user's picked aesthetic photos instead.
  Endpoint: `POST /api/onboarding/reveal` (`server/onboardingReveal.ts`),
  `stylist_knowledge` route, cross-user cache (`kind: internal`, 30 days),
  6 s fallback to a per-aesthetic template, rate-limited 6/hour, not metered.
- **No inline name edit on the reveal.** The name comes from the profile;
  it's editable in Account.
- **Profile table is `users`**, not `profiles`; migration 0066 is on dev + prod.
- **Locale inference uses `Intl`**, not expo-localization (no native rebuild).
- **Deferred-question triggers** (`src/features/profilePrompts/signals.ts`):
  budget on the 1st Shop visit, sizes on the 2nd, shops on the 3rd; fit after
  the 5th stylist message; avoids after the 2nd "Not for me". One prompt per
  app session; 14-day back-off; Profile-only after 2 dismissals. The Profile
  modal needs its own sheet host (native modals sit above the root sheet layer).
- **"Sharpen your stylist" ring shows the count of open questions**, not a
  percentage — the hub's existing completion bar already shows one.
- **Retakes skip the welcome; Back from the first question does not return to
  it** (it's marked seen on Begin).
- **Imagery:** 12 Pexels photos (rows in `assets/onboarding/ATTRIBUTION.md`).
  Street, Edgy and Relaxed were each swapped once (readable logo; too dark;
  fabric rather than a garment).
- **Fixed along the way:** v1 retakes wiped `style_profile_details` when the
  onboarding fields were empty; the mobile normaliser dropped unknown
  detail keys (`paletteSource`); a one-frame flash of the app before onboarding.

### Shipping order

No baseline build — decided 2026-10-09 to ship v2 directly rather than compare
against v1. The v2 funnel is still measurable on its own (events carry
`version: 2`).

1. **Backend deploy** (reveal route + schema). Migration 0066 is already on prod.
2. **App build from `main`.**
