# Calendar Redesign Plan

Goal: turn the Calendar tab from "a calendar with styling" into "a styling
planner that happens to be a calendar". Premium, modern, intuitive,
fashion-forward. Every surface should answer one question at a glance:
**what am I wearing, and for what?**

Mobile-only change. No backend or migration work is required unless noted
(Phase 6 optional).

---

## Design principles

1. **Outfit is the hero.** Imagery outranks text on every row, card and sheet.
2. **One way to do each thing.** No duplicate modes, CTAs or controls.
3. **Signals carry meaning.** A dot, ring or colour must encode a state the
   user cares about (planned vs needs styling), never just "has data".
4. **Quiet chrome, loud content.** The header shrinks; the agenda grows.
5. **One accent.** Walnut `accentInk` (#6F5948) is the only signal colour on
   calendar surfaces: today, needs-styling prompts, countdowns. `success`
   green is removed from calendar surfaces.

## Selection and state grammar (applies everywhere)

| State | Week strip / month cell | Agenda row |
|---|---|---|
| Selected day | Filled ink pill | — |
| Today (not selected) | Number in `accentInk` + 2pt underline, no ring | Day header "Today" in `accentInk` |
| Day has unplanned events | Hollow dot | — |
| Day fully planned | Filled dot | — |
| No events | Nothing | — |
| Event planned | — | Collage thumbnail on the right |
| Event needs outfit | — | Dashed empty garment slot on the right |

The shared helper `dayPlanningStatus(events, date) → 'none' | 'needs' | 'planned'`
lives in `calendarAgenda.ts` and drives both the strip and the month grid.

---

## Phase 1: Unified timeline (structure)

**Problem:** The Upcoming/Day toggle duplicates what the week strip already
does. It also creates conflicting states (today ringed, the 14th filled, Day
selected) and shows 349/98 count dumps.

**Changes**
- Remove the `Upcoming | Day` segmented control and the `showAllUpcoming` and
  `pastExpanded` states in `src/screens/app/CalendarScreen.tsx`.
- Render a single day-sectioned `SectionList` agenda (one section per day
  with events), starting at today and windowed forward.
  - Lazy-load more days on `onEndReached` (pages of 14 days).
  - Past days are reachable by scrolling up (`maintainVisibleContentPosition`
    plus prepending sections on reaching the top). Remove the "Past events · 98"
    accordion.
- **Two-way sync between the strip and the agenda:**
  - Tapping a date calls `scrollToLocation` on that day's section. If the day
    has no events, scroll to the next day that does, and briefly show an inline
    "Nothing on Thu" ghost row.
  - Scrolling the agenda uses `onViewableItemsChanged` to update the strip
    selection, debounced so the two don't fight. This reuses the
    `findAgendaDateIndex` logic.
- The "Up next" hero renders as the list header only while today's section is
  at the top of the list.
- Keep the date-navigation position preservation from d50eda5.

**Files:** `CalendarScreen.tsx` (split it into `CalendarHeader`,
`CalendarAgenda` and `AgendaDaySection` components under
`src/components/calendar/`, since the screen is 965 lines),
`calendarAgenda.ts` (section builder, windowing, `dayPlanningStatus`).

**Tests:** extend `calendarAgenda.test.ts` (section building, windowing,
next-day-with-events fallback, planning status), `calendarNavigation.test.ts`
(strip↔agenda sync), and `CalendarScreen.test.tsx` (toggle gone, no count
strings).

---

## Phase 2: Header and date strip

**Header (`CalendarHeader`)**
- The title becomes the month: "October" in the display serif with a small
  "2026" next to it. Tapping it toggles the month grid (it replaces
  "OCTOBER 2026 ⌄"). Drop the "Calendar / Plan ahead" title block.
- Right side: a `+` icon button (36pt circle) and the `…` button. Move
  "Add event" out of the pill, because synced users rarely create events.
- Remove the `‹ ›` arrows, since the strip already swipes. Show the "Today"
  chip only when the selected date is not visible in the current week, and
  animate it in and out.
- On scroll, collapse to a compact sticky bar (month label 17pt plus the
  strip). Reuse the existing `isStripStuck` logic, but cross-fade the big
  title out instead of hard-switching.

**Week strip (`WeekStrip.tsx`)**
- Apply the state grammar above. Replace the outlined today-ring with the
  accent number and underline. Show dots only for `needs` (hollow) and
  `planned` (filled).
- Selection pill animates between days (Reanimated shared value on x
  offset, spring `damping 20 / stiffness 220`).
- Use the same weekday labels as the month grid. Pick `M T W T F S S` (single
  letter, uppercase, tracking +0.5) for both.
- Day headers in the agenda show a weather glyph and the high temperature
  ("☁ 8°") on the right when a forecast exists (data already on events;
  see `WEATHER_ICONS`).
- Haptics: `selectionAsync` on date change.

---

## Phase 3: Outfit-forward event rows

New component `AgendaEventRow` replaces the current row markup.

```
┌──────────────────────────────────────────────┐
│ 4:00   AHD supervisor – Cardiovascular  ┌───┐│
│  AM    monitoring (excluding echo)      │▣▣▣││  ← 60pt collage
│        Casual                           └───┘│
└──────────────────────────────────────────────┘
│ 7:00   Memorial at VH                   ┌┄┄┄┐│
│  AM    Formal                           ┆ + ┆│  ← dashed slot, "Style"
│                                         └┄┄┄┘│
```

- **Time column:** fixed 52pt width, tabular figures, with the time and
  AM/PM stacked. Titles align.
- **Title:** serif, max 2 lines, ellipsised.
- **Meta line:** dress code as plain `textSecondary` (no bold), plus the
  location if present. Drop the "✨ Needs outfit" line, because the slot
  conveys it.
- **Right slot (60×60, 10pt radius):**
  - Planned: `EventLookCollage` in a compact mode (2–3 overlapping
    cut-outs, 1pt hairline border).
  - Needs outfit: dashed `accentInk` border at 40% opacity with a `sparkles`
    glyph. Tapping the slot jumps straight to planning (skipping the sheet),
    and tapping elsewhere on the row opens the detail sheet.
- **All-day events** render as a slim banner at the top of the day section
  (single line: title · location · slot thumb at 28pt), not a full row.
- Row press: scale 0.98 with a light haptic.
- Entry animation: staggered fade/translate (30ms per row, first 8 only).

**Files:** new `AgendaEventRow.tsx` and `AllDayBanner.tsx`, plus a
compact variant in `EventLookCollage.tsx` / `ItemThumbStack.tsx`.

---

## Phase 4: "Up next" hero

`NextEventHero.tsx` becomes an editorial card:
- Tinted surface (`accent` #E8DED1 wash, 20pt radius, no border).
- Overline countdown in `accentInk`: "IN 2 HRS", "ALL DAY", or "NOW".
- Larger serif title (28pt), then a meta chip row: time · dress code · weather.
- **Specific copy** replaces "A look from your wardrobe, ready for this
  occasion". Write a small pure function `heroPrompt(event, weather)` →
  e.g. "8° and drizzly — layers recommended.", "Professional — sharpen the
  basics.". Fall back to the dress-code line.
- **Planned state:** a full-bleed collage at the top of the card (4:3), with
  primary **Wear this** (logs to the wear log, reusing the existing wear-log
  commit path) and secondary **Swap**.
- **Unplanned state:** a single **Plan my look** CTA.

**Tests:** `heroPrompt` unit tests in `calendar-presentation.test.ts`.

---

## Phase 5: Event detail sheet

`EventDetailModal.tsx` is reordered around the outfit:

1. Header: close and `…` (unchanged).
2. Title (serif) and a status pill. Planned uses an ink check plus "Look
   planned". Unplanned uses an `accentInk` "Needs a look". Remove the green.
3. **Outfit canvas, directly under the title:**
   - Planned: an edge-to-edge collage (the existing collage, larger), plus a
     "3 pieces · View outfit →" row.
   - Unplanned: an empty canvas with three dashed silhouette slots (top /
     bottom / shoes). Tapping the canvas starts planning. Remove the
     "Ready to style" block.
4. **Logistics chips** in one wrapping row: `🗓 Wed 4:00 AM`, `Casual`,
   `☁ 10–15°`. The weather fallback paragraph becomes an `ⓘ` on the weather
   chip that opens a tooltip.
5. **Event details:** collapsed to a single line preview by default, and
   expanded on tap (`presentEventNotes` already exists).
6. **Source footer:** one row, "Synced from Google · Open ↗", replacing the
   three-line "From… / Edit calendar details… / Open calendar" block.

**Sticky footer**
- Unplanned: primary **Plan my look**, plus the text link "or choose from
  closet" (opens the existing picker menu).
- Planned: primary **Wear this**, secondary ghost **Refine**, and "Choose a
  look" moves into the `…` menu.

**Motion:** a shared-element transition from the row's 60pt collage to the
sheet's canvas (Reanimated `sharedTransitionTag`, if stable on SDK 56;
otherwise a fade/scale fallback). Success haptic when a look is saved.

**Tests:** update `EventDetailModal.test.tsx` for the new order, CTA labels,
collapsed notes and footer copy.

---

## Phase 6: Month view as lookbook

The expanded month grid (`WeekStrip.tsx` month mode):
- Planned days show a 28pt circular crop of the look's lead piece instead of
  the number background, with the number overlaid bottom-right in small text.
- Days that need styling get a hollow `accentInk` ring, and all other days
  show the bare number.
- Close the gap between the grid and the agenda. The agenda follows directly.
- Swipe left and right to change months, with a haptic at month boundaries.

*Optional backend:* if the lead-piece thumbnail isn't on the event payload,
add `leadThumbUrl` to the events list response in `../Styled`. Check this
first, because `presentEventLook` may already provide it.

---

## Phase 7: Empty states, past days and polish

- **Empty day** (selected via strip with no events): an editorial card
  reading "Free day." with a contextual nudge. Weekends get "Want a weekend
  look?", which opens the stylist with a weekend prompt. Weekdays get "Plan
  tomorrow's look".
- **Past days** (scrolled up): rows show the outfit actually worn when a
  wear log entry exists ("Worn" tag), with a muted title colour. This turns
  history into a journal.
- **No calendars connected:** a hero card with a sync CTA (reuse
  `CalendarSyncSheet`).
- **Accessibility:** combined row labels ("4 AM, AHD supervisor, casual,
  outfit planned"), 44pt hit targets on slots and the strip, and Dynamic Type
  up to XL without truncating the time column.
- **Reduce Motion:** disable stagger and shared transitions, and keep
  cross-fades.
- **Dark mode:** verify the dashed slot and accent contrast (4.5:1 for text).

---

## Sequencing and effort

| Phase | Scope | Est. | Depends on |
|---|---|---|---|
| 1 Unified timeline | Structure, highest risk | 1.5–2 d | — |
| 2 Header + strip | Visual + motion | 1 d | 1 |
| 3 Event rows | New components | 1 d | 1 |
| 4 Hero | Copy + card | 0.5 d | 3 (collage variant) |
| 5 Detail sheet | Reorder + footer | 1 d | 3 |
| 6 Month lookbook | Grid cells | 0.5–1 d | 2 |
| 7 Empty/past/polish | States, a11y | 1 d | 1–5 |

Phases 1, 2 and 3 deliver most of the perceived change, so ship them
together. Phases 4 and 5 are independent of each other after Phase 3.

## Verification per phase

- `npm run typecheck` and `npm test -- calendar` pass.
- Simulator pass (`npm run ios`) against the real synced account (349
  upcoming events) covering:
  - strip tap → agenda scroll, agenda scroll → strip follow
  - today vs selected visuals
  - planned vs unplanned rows and all-day banner
  - sheet in both states
  - month grid
  - empty day
  - scroll-up into past
- Screenshot each surface before and after for review.
- Performance: the agenda stays at 60fps when flinging through 300+ events
  (check `windowSize` and `getItemLayout` on fixed-height rows).

## Risks

- **Strip↔agenda feedback loops:** guard with an `isProgrammaticScroll` ref
  that is cleared in `onMomentumScrollEnd`.
- **Prepending past sections:** `maintainVisibleContentPosition` on iOS can
  jump. Fall back to a "Show earlier" header row if needed.
- **Shared-element transitions on SDK 56:** confirm against the versioned
  docs before relying on them, and keep the fallback.
- **Removing the "Upcoming" list** changes a learned flow. The unified
  timeline starting at today preserves the same mental model.

## Out of scope

- Editing synced event details (still read-only by design).
- New stylist capabilities beyond the existing plan/refine flows.
