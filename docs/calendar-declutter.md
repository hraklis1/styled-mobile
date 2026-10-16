# Calendar Declutter — Plan

**Status (Oct 16 2026): all phases implemented.** Deviations from the plan below:
- "Earlier" is gone: scrolling up past today (after a user drag) loads `PAST_PAGE` more days via `onStartReached`. `maintainVisibleContentPosition` is enabled only while prepending history and switched off again by strip date jumps, which own the scroll position.
- `TripDayBand.tsx` became `tripDays.ts` (helpers only). `UpcomingTripsRow.tsx` was deleted because nothing else used it.
- Open question 1 is implemented: a trip leaving today or tomorrow, on a day with nothing timed, leads the agenda (`trip-hero`).
- Page padding moved from the list's content container onto each cell, because FlashList draws pinned headers outside the container's padding.

Oct 16 2026. Follows `calendar-redesign.md` (outfit-first calendar) and the Trip ⇄ Calendar link (375085b).

## Problem

Since trips were added, the Calendar tab repeats information and gives almost every row its own button:

| Symptom | Where it comes from |
|---|---|
| The same trip shows up 3 ways: chip, "Plan a trip" pill, and a band on every day | `UpcomingTripsRow` in `stripArea` (`CalendarScreen.tsx:743-752`); `TripDayBand` added under each `day-heading` (`CalendarScreen.tsx:567-574`) |
| Hero card built around an all-day event ("ALL DAY TODAY · AMG") | `nextEvent = upcoming[0]` (`CalendarScreen.tsx:235`). `sortCalendarEvents` puts all-day events first (`calendarAgenda.ts:42-46`), so the hero can be a shift or reminder |
| A sparkle button on every all-day row | `AllDayBanner` renders a 28pt `LookSlot` (`AgendaEventRow.tsx:142-160`), although `buildPlanningStatusMap` already says all-day events never need a look (`calendarAgenda.ts:69-81`) |
| Three different row styles | Grey all-day pill (`s.banner`), serif timed row (`s.title` = `editorialCard`), tan trip band (`TripDayBand.styles.band`) |
| Today card is too heavy | `NextEventHero`: overline, serif title, 2–3 chips, a `heroPrompt` sentence and a full-width primary `HeroButton` |
| Rows lose their day context while scrolling | `day-heading` is a normal FlashList row with no sticky header (screenshot 2: "Lo+Luca" has no header) |
| "Earlier" button | `kind: 'earlier'` row (`CalendarScreen.tsx:552-563`) |

**Goal:** each day shows a header, at most one line of all-day events, and the same row layout for every timed event. Trips appear as a date span, not as cards. There's one primary action on screen.

---

## Phase 1 — Trips: show the span on the strip, remove the cards

**1a. Trip span bar in `WeekStrip`.**
- New prop: `tripSpans?: { id: number; destination: string; startDate: string; endDate: string }[]`.
- In `renderDay` (`WeekStrip.tsx:166`), draw a 3pt `colors.accentInk` bar under the day for each date where `tripOnDate` matches.
  - It sits below the planning `dot`.
  - Rounded caps go on the start and end dates and on the week's edge days.
- Add one `destination` label, rendered once per visible week at the bar's first visible day (caption, `accentInk`). It's absolutely positioned so cells don't change width.
- Tapping a day still selects the day. Tapping the label opens the trip (`onOpenTrip(id)`).
- Month grid (`expanded`, around `WeekStrip.tsx:210`): the same bar under each `compactNum`.
- a11y: append `, Lisbon trip day 2 of 5` to `dayLabel` (reuse `dayNumber` from `TripDayBand.tsx`, exported).

**1b. Remove `UpcomingTripsRow` from `stripArea`.**
- Delete the call at `CalendarScreen.tsx:743-752`.
- "Plan a trip" is already in the `ActionMenuSheet` "Calendar tools" (`CalendarScreen.tsx:848`). Also add it to the `+` button: `onAddEvent` → a short action sheet: *Event* / *Trip*.
- Add a "Trips" option to the `•••` menu that opens a sheet listing upcoming and past trips. Reuse the existing `pastTripsVisible` `ActionMenuSheet` (`CalendarScreen.tsx:853-865`), widened to `[...tripShelf, ...tripArchive]` under the title "Trips".
- Keep `UpcomingTripsRow.tsx`; Home may still want it. If it ends up unused, delete it (grep `UpcomingTripsRow` before deleting).

**1c. Trip goes into the day header instead of a band.**
- Replace `TripDayBand` in the `day-heading` case with an inline suffix on the heading:
  `Mon, Oct 19` · *Lisbon · day 2 of 5* (`accentInk`, regular weight), pressable → `setOpenTripId`.
- On the first day, the suffix reads `Leaving for Lisbon · 0 of 7 packed`, keeping the packing nudge from `TripDayBand`.
- Turn `TripDayBand.tsx` into a `tripDayLabel(trip, date): string` helper plus `tripOnDate`, and drop the component.

**1d. Trip-like calendar events.**
- If a calendar event is the trip itself (`isTripLikeEvent` and a linked `tripForEvent`), hide its row on the trip's days; the header suffix already represents it.
- If it's trip-like but not yet linked, keep the row. Its action stays "Plan this trip" via `planFromAgenda` (`CalendarScreen.tsx:403`).

## Phase 2 — Collapse all-day events, use one row layout

**2a. `AllDayLine` replaces `AllDayBanner`.**
- In `timelineItems` (`CalendarScreen.tsx:258-262`), emit one item per day instead of one per all-day event:
  `{ kind: 'all-day-line'; key: \`allday-${date}\`; date; events: Event[] }`.
- Render it as plain text under the heading, with no fill and no sparkle:
  *All day · Simona away, Regular | VH* (caption kicker + `bodySmall`, `numberOfLines={1}`).
- Tap behavior:
  - One event → `setDetailEvent`.
  - Several events → expands inline into one-line entries, each opening its detail. Store the expanded state in a `Set<string>` by date.
- Exception: an all-day event that does have a planned look (`itemIds.length`) is promoted to a full `AgendaEventRow` with time column "All day". This keeps `buildPlanningStatusMap`'s "planned" dot consistent with what the list shows.
- Delete `AllDayBanner`, `BANNER_SLOT` and the `s.banner*` styles from `AgendaEventRow.tsx`.

**2b. `AgendaEventRow` — the only row layout.**
- Title uses sans `typography.text.label`/`body` semibold instead of serif `editorialCard` (`AgendaEventRow.tsx:180`). Serif is kept for day headings.
- Empty `LookSlot` (`s.slotEmpty`): change the 60pt dashed box with a sparkle to a 44pt dashed outline with a faint `+`, so it reads as an empty slot rather than a call to action. Planned slots stay at 60pt with the collage.
- Don't change the row's hit targets.

**2c. Sticky day headers.**
- FlashList v2: `stickyHeaderIndices` built from `timelineItems` (indices of `day-heading`).
- Give the heading row `backgroundColor: colors.background` and a hairline under it when stuck.
- `onViewableItemsChanged` already ignores items without a date, so strip syncing is unaffected. Verify that `scrollToIndex` with `viewPosition: 0` still lands below the stuck header.

**2d. Replace the "Earlier" button.**
- Remove the `earlier` item.
- Use `onStartReached` (FlashList v2) with `maintainVisibleContentPosition` turned on only for that prepend. Currently it's disabled globally (`CalendarScreen.tsx:763`) because of date jumps. Keep it disabled while a `scrollRequest` is pending.
- Fallback if prepending jumps: keep the row, but as a quiet caption-only link with no chevron.

## Phase 3 — A lighter Today card

**3a. Choose the right event.**
- Add `heroEventFor(upcoming)` in `calendarAgenda.ts`: the first upcoming **timed** event, or an all-day event only if it has a planned look. Use it instead of `upcoming[0]` at `CalendarScreen.tsx:235`.
- Show the hero only when that event is today or tomorrow. Later events render as normal rows, so a quiet week doesn't feature a card about something 9 days away.
- If no event qualifies and today has events (all-day only): no card. Today's `day-placeholder`-style prompt reuses `openStylistForFreeDay` ("What are you wearing today?" + "Log wear").

**3b. Slim down `NextEventHero`.**
- Remove the chip row. Weather becomes one meta line next to the overline: `TODAY · 2:00 PM · Rain 5–20°`.
- Remove the `heroPrompt` sentence, or keep it only when weather is notable (rain/cold). Gate it in `calendar-presentation.ts` (`heroPrompt` returns `null` when the weather is unremarkable).
- Unplanned: replace the full-width black `HeroButton` with a right-aligned text action `Plan look →`, with an empty 60pt `LookSlot` as the visual anchor.
- Planned: unchanged (collage + "Wear this").
- `card` background: switch from `colors.accent` fill to `colors.card` with a hairline, so tan stays reserved for trips.

## Phase 4 — Final polish

- `stripArea` bottom hairline: keep it. Once `UpcomingTripsRow` is gone, the strip shrinks by about 90pt.
- Header buttons stay `Today` (only when away from today), `+`, `•••`.
- Spacing: `dayHeading.marginTop` from `xl` to `xxl`, so sections separate by whitespace instead of filled boxes.
- Copy: `TripDayBand` a11y strings move to the header suffix.

---

## Files touched

| File | Change |
|---|---|
| `src/screens/app/CalendarScreen.tsx` | Remove `UpcomingTripsRow`; new `all-day-line` item; header trip suffix; `heroEventFor`; sticky indices; earlier → onStartReached; `+` sheet; Trips menu entry |
| `src/components/calendar/WeekStrip.tsx` | `tripSpans` bar + label in week and month views; a11y |
| `src/components/calendar/AgendaEventRow.tsx` | Remove `AllDayBanner`; add `AllDayLine`; sans title; lighter empty slot |
| `src/components/calendar/TripDayBand.tsx` | Becomes helpers `tripOnDate`, `tripDayLabel` (component removed) |
| `src/components/calendar/NextEventHero.tsx` | No chips, meta line, text CTA, card surface |
| `src/components/calendar/calendarAgenda.ts` | `heroEventFor`; optional `groupAllDay` helper |
| `src/components/calendar/calendar-presentation.ts` | `heroPrompt` can return `null` |
| `src/components/trips/UpcomingTripsRow.tsx` | Unused by Calendar; delete if nothing else uses it |

No backend or migration changes.

## Tests

- `calendarAgenda.test.ts`: `heroEventFor` skips unplanned all-day events, accepts a planned all-day event, and enforces the today/tomorrow window.
- `src/screens/app/__tests__/CalendarScreen.test.tsx`: update for the removed trip row and the collapsed all-day line. Check that a linked trip event row is hidden on trip days and that the header suffix opens `TripDetailModal`.
- New `TripDayBand` helper tests: `tripDayLabel` for the first day (packing), middle days and a 1-day trip.
- `src/features/trips/__tests__/presentation.test.ts`: unaffected; run it anyway.
- `npm run typecheck`, then `npx jest src/components/calendar src/screens/app/__tests__/CalendarScreen.test.tsx`.

## Simulator verification (per phase)

Using the same data as the screenshots (Lisbon Oct 18–22; AMG, Flex Day, Lo+Luca, Simona away, Tony eye surgery):
1. Strip shows a bar under 18–22 labelled "Lisbon"; no chip row; tapping the label opens the trip.
2. Oct 19 header reads `Mon, Oct 19 · Lisbon · day 2 of 5`; one all-day line; "Tony eye surgery" is a single timed row with a 44pt empty slot.
3. Today (Oct 16, all-day only) shows no hero, just the quiet prompt. On Oct 19 the hero is Tony eye surgery.
4. Scrolling keeps the current day header pinned; the strip selection follows.
5. Count tappable controls in the first screenful: target ≤ 3 primary/secondary actions (excluding rows).

## Open questions

1. When the trip is the hero day (e.g. the departure day), should the hero become the trip ("Leaving for Lisbon · 0 of 7 packed → Pack") instead of an event? Recommended: yes, if no timed event that day.
2. Should Home's `HomeTripCard` adopt the same tan "span" language, for consistency?
