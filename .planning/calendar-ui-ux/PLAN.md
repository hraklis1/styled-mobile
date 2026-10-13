# Calendar UI and UX implementation plan

Status: Implementation complete; automated checks and default iPhone walkthrough recorded in VERIFICATION.md. Additional platform/accessibility visual coverage remains outstanding.
Date: 2026-10-13
Scope: Calendar and every supporting calendar flow; unrelated Home, Closet, Stylist, and Shop screens are excluded except regression checks at shared boundaries.

## Outcome

Make Calendar a clear planning tool with Styled’s warm, editorial visual identity. Users can immediately understand which date they are viewing, see their events, recognise outfit readiness, and plan or change a look without hunting through menus.

This standalone plan follows the repository’s existing `.planning/<feature>/PLAN.md` convention. There is no project roadmap or numbered phase to attach it to. The previous screenshot/code assessment supplies the brief. Implement in the order below, directly on main. Leave changes uncommitted; no branches, PRs, commits, or pushes. Completed changes must be active by default.

## Evidence and constraints

- `CalendarScreen.tsx` currently uses a continuous upcoming/past timeline, a global first-event hero, transient selection highlights, and date jumps conditional on the strip already being pinned. This explains selected Wednesday appearing above Tuesday’s hero.
- `NextEventHero.tsx` always renders its full-width image band, even with no planned pieces. The placeholder takes the space intended for useful photography.
- `WeekStrip.tsx` already supports week swipes, month paging, Today, selected/today distinctions, and 44-point navigation targets. Preserve those useful affordances.
- Event rows repeat date blocks; their `editorialSection` titles outweigh metadata. `EventDetailModal.tsx` uses a large bold sans title and places source instructions/notes ahead of the planned look.
- `CalendarSyncSheet.tsx` has connection management, calendar selection, automatic sync, device providers, and feeds. Its large introduction is also shown to connected users.
- Event readiness currently derives from item IDs. Preserve this contract while checking outfit-only and unresolved-item cases; do not silently redefine persistence semantics.
- Event deletion calls `/api/events/:id`. The UI alone does not establish whether a removed imported event can reappear after sync. Inspect the sibling backend read-only before promising permanent removal.
- SDK is Expo 56 with `@expo/ui` installed. Exact references consulted: https://docs.expo.dev/versions/v56.0.0/ and https://docs.expo.dev/versions/v56.0.0/sdk/ui/. Consult the exact component documentation before implementation. Retain the current navigation architecture; this task does not migrate the app to Expo Router.
- Reuse the existing palette, typography, spacing, button, image, and motion primitives. No new visual system or dependency upgrade. Inspect native Expo UI equivalents for new menu/selection controls before choosing custom implementations.

## Product decisions

### Calendar views and navigation

1. Default to **Upcoming**, clearly labelled, with a compact Day / Upcoming view selector next to the agenda context. Upcoming is a continuous chronological list grouped by date.
2. Selecting any date switches to **Day**, filters to that date, and reveals its agenda consistently whether the page is at the top or scrolled. No unrelated global hero remains above that day’s events.
3. Day context explicitly reads `Today · Tue, Oct 13`, `Tomorrow · Wed, Oct 14`, or the full weekday/date. Include the year when different from the current year.
4. Keep the date selection distinct from today: filled selected date, outlined today when unselected. In Upcoming, no date is visually selected; today may retain its outline.
5. **Today** switches to Day for the actual local current date, moves the strip to its week, resets month navigation, and reveals the agenda. Show Today consistently so its appearance does not shift other controls.
6. Switching back to Upcoming clears the active day filter and restores the upcoming agenda start. Browsing weeks/months alone changes the calendar viewport, not the active filter. Keep the agenda date heading visible so the distinction is clear.
7. Selecting a month-grid date collapses to its containing week, selects that date, and reveals Day. This includes adjacent months/year boundaries. Expanding/collapsing without selecting preserves the current view and date.
8. Add event uses the selected date in Day; in Upcoming it defaults to today. Returning from details or a picker retains the prior view, selected date, and scroll position. Tab re-tap keeps the existing scroll-to-top convention.
9. Past dates use Day, with existing wear logging available. Preserve access to past history through a quiet `Past events` section/action in Upcoming.

### Visual hierarchy

- Preserve warm stone ground, obsidian primary actions, restrained walnut accents, and Newsreader editorial type.
- Use the existing page gutter (24) on Calendar and align detail/sync content consistently with its sheet chrome. Use the existing 4-point spacing scale.
- Date group headings provide structure once per day. Within each group, use time → event name → context → readiness. All-day events appear first, followed by timed events ascending; equal times have a stable order.
- Use `editorialCard` for ordinary event titles, allowing two readable lines. Keep the complete title in details and accessibility labels. Use `editorialCompact` for the featured upcoming event and `editorialSheet` for detail titles, allowing full wrapping.
- Ordinary event rows use hairlines and spacing, not a white card per event. Reserve a contained surface for a planned look and essential grouped detail metadata.
- All interactive targets remain at least 44 points. Text and rows grow with accessibility sizes; avoid fixed heights around long text.

### Outfit presentation and actions

- Upcoming’s first event may be featured once. Without a planned look, show compact title/context and `Plan my look`; render no large image placeholder. Subsequent events stay visible sooner.
- With a planned look, retain the collage or generated photo. Missing/deleted pieces receive bounded fallbacks within that look; they must not create a giant empty hero or falsely imply no plan.
- Day uses uniform event rows; no global hero competes with its selected date.
- Detail order: title and readiness → essential date/time/occasion/location/weather → planned look or compact ready-to-style message → notes → source information.
- Pin one primary footer action: **Plan my look** when unplanned, **Refine my look** when planned. Its accessible label includes the event name. Reuse the existing Stylist handoff and busy guards.
- Secondary action **Choose a look** opens one concise menu: **Saved outfits**, **Choose items** (or **Edit items**), **Plan from a board**. Remove the duplicate board entry from Event options. Choosing a board retains its existing planning semantics; do not treat it as an already-assigned outfit.
- Preserve `View outfit` on a planned look and the custom-piece view path. Do not turn viewing into a mutation.

### Copy and management

- Normalise occasion display through `OCCASIONS` labels; keep stored IDs unchanged. Unknown values receive readable fallback formatting.
- Source copy becomes `From <calendar name>` plus `Open calendar` where a supported source URL exists. Put the explanation that source details are edited externally beside the source/edit action rather than ahead of the look.
- Destination weather retains its location; fallback reads `Weather near <location>`. Provide short supporting text explaining that the event location was unavailable. Preserve unavailable/loading weather states; never present an assumption as an event-specific forecast.
- Event options contain Edit event/Edit styling details, Open calendar where available, and the appropriate removal action. Calendar tools keep Log wear and Calendars & sync.
- Imported removal reads `Remove from Styled`; local removal reads `Delete event`. Confirmation identifies the scope and says the source is unchanged for imported events. Verify reimport behaviour and state it truthfully. Do not invent backend suppression or add it silently.
- Menus use compact grouped rows with restrained icons; separate destructive action visually. Existing shared menu callers keep their current appearance unless explicitly opted into a compact calendar variant.
- Use sentence case: New event, Edit event, Event name, Occasion, Location (optional), Venue type. Saved outfit confirmation reads `Use outfit`; individual piece confirmation reads `Save look` with a selection count; board selection has an explicit action matching whether it selects or starts planning.

## Execution sequence

### 01 — Presentation model and reusable calendar styling

Dependencies: none.
Files: `calendar-presentation.ts`, `calendarPlanning.ts`, `calendarAgenda.ts`, `calendarUtils.ts`; existing theme and primitives only when required.

- Define shared display labels, source/weather wording, day headings, readiness/action labels, and calendar-only presentation styles.
- Model Day vs Upcoming explicitly; use pure agenda-building helpers rather than deriving visible behaviour from scroll position.
- Use the existing all-day date metadata and local date conventions consistently; check `allDayDate`, event timestamps, and time zones before grouping. Do not introduce UTC slicing for local day identity.
- Inspect deletion behaviour in `../Styled` and record the actual contract in implementation notes. Backend edits are outside this plan; any required change is a separate scoped dependency.
- Keep existing external event/source URLs subject to current supported-scheme checks.

Acceptance: one shared formatter supplies matching labels across agenda/details/actions; stored occasion IDs and event payloads remain unchanged; deterministic date/view behaviour has meaningful regression coverage.

### 02 — Calendar page, date navigation, and adaptive featured event

Dependencies: 01.
Files: `CalendarScreen.tsx`, `WeekStrip.tsx`, `NextEventHero.tsx`, `calendarAgenda.ts`, relevant calendar tests.

- Replace scroll-gated selection with the explicit Day/Upcoming model above.
- Group ordinary events under one date heading and remove repeated date columns. Preserve thumbnail readiness actions and complete accessible names.
- Keep FlashList virtualisation for Upcoming. Ensure sticky calendar measurements include any persistent view controls; remove obsolete highlight timers/jump effects when filtering makes them unnecessary.
- Collapse the month and navigate its viewport when a day is selected. Reduce excess grid-to-agenda spacing without reducing targets.
- Make the upcoming hero conditional on actual look content; compact event-first layout otherwise. Avoid duplicating the featured event in its date group.
- Recompute Today/day boundaries after foregrounding and midnight so the view does not retain yesterday’s date.
- Ensure data refresh does not reset user selection or scroll, and handle selected-day deletion by showing that day’s empty state.

Acceptance: selecting Wednesday shows only Wednesday immediately; selection from the top and pinned states behaves identically; empty selected days show their date, Add event, and Log wear; an unplanned hero has no empty image band; month selection reveals events; Upcoming retains chronological grouping and past access.

### 03 — Event detail hierarchy and consolidated outfit choice

Dependencies: 01; integrate after 02.
Files: `EventDetailModal.tsx`, `EventLookCollage.tsx`, `EventOutfitPickerModal.tsx`, `EventItemPickerModal.tsx`, `EventBoardPickerModal.tsx`, `OutfitGeneratedSheet.tsx`, relevant handoff callbacks in `CalendarScreen.tsx`.

- Apply serif detail titles with full long-title wrapping and reorder sections as specified.
- Keep the planned collage immediately after essential context; render a compact readiness message instead of empty imagery when unplanned.
- Move notes and source information below the look; retain expansion, links, and selectable text.
- Implement the single Choose a look entry and remove duplicate planning routes. Verify nested sheet dismissal/presentation on device; avoid two competing modal presentations.
- Keep pinned actions clear of the home indicator, keyboard, and scroll content. Long titles may require scrolling, but the next useful action remains available.
- Update action labels, loading/disabled states, persistence feedback, and errors together. Cancel must preserve the previous look; failure must retain the selection for retry.

Acceptance: a typical event exposes its look sooner; long imported titles remain readable; each selection path is reachable once; saved outfits/items/boards retain correct IDs and existing Stylist context; back/cancel returns to the same event; double-tapping cannot duplicate assignments or planning requests.

### 04 — Forms, menus, and removal clarity

Dependencies: 01 and 03.
Files: `EventFormModal.tsx`, `CalendarPickerSheet.tsx`, `EventDetailModal.tsx`, `CalendarScreen.tsx`; `ActionMenuSheet.tsx` or `SheetOptions.tsx` only with an opt-in calendar treatment.

- Standardise form labels and action vocabulary; keep optional styling details progressively disclosed.
- Distinguish editable local details from source-controlled imported fields. Make imported source navigation discoverable without presenting disabled fields as unexplained dead controls.
- Keep keyboard avoidance, location autocomplete, date/time controls, unsaved-change protection, validation, and inline errors.
- Compact Event options and Calendar tools. Apply removal copy only after the contract inspection in 01; retain confirmation and error handling.
- Selection screens provide search, empty/no-results states, visible selection, and a clear commit/cancel pattern. Empty board/outfit states explain the next available path without trapping the user.

Acceptance: every field and action uses consistent sentence case; editing imported styling never changes source data; menu targets remain at least 44 points; removal scope and reimport expectations match actual behaviour; unrelated shared menus do not change.

### 05 — Calendars and sync management

Dependencies: 01; integrate after 04.
Files: `CalendarSyncSheet.tsx`, its tests, `docs/calendar-sync.md`.

- Determine introductory vs management layout from actual loaded connection state, not a fragile local first-run flag. While loading, do not flash onboarding. Existing connections with zero selected calendars still show management and setup guidance.
- With no connections, retain a shorter editorial introduction and read-only reassurance. With connections, lead with connection cards and sync state; move reassurance to compact supporting copy.
- Make `Choose calendars` the setup/management action; keep Sync now, automatic-sync controls, progress, last-updated time, failure/reconnect recovery, and Disconnect clearly distinguishable.
- Explain direct Google/Outlook connections versus accounts accessed through the device. Preserve provider availability/configuration checks; avoid rendering an unavailable direct provider as a working connection route.
- Group Apple/device connection choices, supported direct providers, and calendar feeds without duplicate-looking Outlook options. Keep existing deduplication guidance visible at selection time.
- Preserve automatic-sync/disconnect/imported-plan semantics. Successful calendar selection and refresh update counts/status without closing context unexpectedly.

Acceptance: returning users reach connections without scrolling past marketing copy; new users understand their choices; provider cancellation, denied device permission, expired auth, zero calendars, malformed feed, offline status, sync failure, and retry each have a clear recovery path.

### 06 — Integration, visual QA, and completion

Dependencies: 02–05.
Files: calendar tests and `docs/calendar-sync.md` where behaviour changed; save QA evidence beside this plan.

- Run targeted calendar logic/component tests, then typecheck and lint for changed files. Run the project check once after integration; document pre-existing failures separately and fix regressions introduced here.
- Launch using `npm run ios`; verify existing Metro before starting another server. Follow AGENTS.md pod/header repair instructions only if those issues occur.
- Capture before/after equivalents for the eleven supplied screenshot states plus new Day, empty-day, form, and picker states. Keep screenshots free of real personal calendar details when storing durable evidence.
- Check compact and default iPhone sizes, largest practical accessibility text, VoiceOver reading/focus order, Reduce Motion, and Android parity if a local Android target is available. Report any unavailable platform verification explicitly.
- Walk the complete flow: select date → open event → plan/refine → return → choose outfit/items/board → verify readiness → edit styling → remove/cancel → return to same day → manage calendars → sync → verify agenda update.

Acceptance: all requirements below pass; no hidden completed feature flags; no unrelated app changes; working tree ready with verification results, no commit/push.

## Regression and visual test matrix

| Area | Cases | Pass condition |
|---|---|---|
| Date selection | Top/pinned scroll, today/tomorrow/past, empty day, month/year boundary, repeated tap | Active date and visible events always agree; no sticky-header occlusion |
| Date correctness | All-day source date, timed events near midnight, DST, app foreground after midnight | Correct local day, stable sorting, current Today marker |
| Agenda | Multiple same-day events, zero events, many events, equal times, refresh/removal | One day heading, no duplicates, stable view and virtualised scrolling |
| Featured event | No look, saved outfit, custom pieces, generated photo, missing pieces/images | No empty large hero; valid planned imagery retained; accurate readiness |
| Detail | Very long title, no notes, long notes/links, no location, fallback/unavailable weather | Useful hierarchy, full details available, honest context, clear footer |
| Planning | Plan/refine, outfit/items/board, cancellation, failed assignment, rapid taps | Correct event/look IDs, no duplicate writes, retry/cancel preserves state |
| Form | Local/imported, keyboard open, invalid input, unsaved close | Clear editable scope, reachable fields/actions, existing guards retained |
| Sync | No connections, connected/zero selected, unavailable provider, permission/auth failure, offline, retry/disconnect | No onboarding flash; clear scope/status/recovery; existing plans preserved |
| Accessibility | Large type, VoiceOver, Reduce Motion, contrast and touch targets | No clipping or inaccessible actions; selected/busy/expanded states announced |
| Shared boundaries | Home look, Stylist handoff, other action menus, tab navigation | Existing appearance and behaviour retained outside calendar |

Automated tests should exercise changed behaviour, not snapshot every spacing value. Extend existing `calendarAgenda`, `calendar-presentation`, `calendarPlanning`, `calendarUtils`, and `CalendarSyncSheet` tests. Add focused screen interaction coverage for view switching/month selection and modal action handoffs where existing harnesses support it. Use fixed clocks and fixtures for date tests.

## Coverage checklist

- [x] CAL-01 Explicit date/view relationship and predictable Today/month behaviour — 01, 02.
- [x] CAL-02 Compact no-look hero; preserved real outfit imagery — 02, 03.
- [x] CAL-03 Month selection reveals agenda and spacing improves — 02.
- [x] CAL-04 Grouped dates and scannable event typography — 02.
- [x] CAL-05 Outfit-first detail hierarchy and consistent serif titles — 03.
- [x] CAL-06 One primary action and consolidated manual/board choices — 03, 04.
- [x] CAL-07 Concise source copy, honest weather assumptions, normalised occasions — 01, 03.
- [x] CAL-08 Compact tools/options and accurate imported removal wording — 01, 04.
- [x] CAL-09 Returning-user sync layout and clear provider choices — 05.
- [x] CAL-10 Consistent forms, pickers, confirmation language and recovery — 03–05.
- [ ] CAL-11 Accessibility semantics and default iPhone flows implemented/checked; compact-device, largest-text, spoken VoiceOver, Reduce Motion and Android runtime checks remain — see VERIFICATION.md.

## Completion evidence

Record changed files, test/check results, screenshots reviewed, platform coverage, and any confirmed backend limitation in `VERIFICATION.md`. Mark checklist items complete only after implementation and verification. This plan itself does not claim the redesigned app or any runtime checks are complete.

## Reproducible verification commands

Run the existing targeted suite after the affected tasks, then once after integration:

```sh
npm test -- --runTestsByPath src/components/calendar/__tests__/calendarAgenda.test.ts src/components/calendar/__tests__/calendar-presentation.test.ts src/components/calendar/__tests__/calendarPlanning.test.ts src/components/calendar/__tests__/calendarUtils.test.ts src/components/calendar/__tests__/calendarSyncUtils.test.ts src/components/calendar/__tests__/CalendarSyncSheet.test.tsx
npm run typecheck
npm run lint
npm run check
npm run ios
```

Add behavioural interaction coverage in `src/components/calendar/__tests__/calendarNavigation.test.ts` for the extracted view/date transition logic. If the screen harness supports rendering navigation and sheet dependencies without replacing their behaviour, add `src/screens/app/__tests__/CalendarScreen.test.tsx` for selected-date rendering and `src/components/calendar/__tests__/EventDetailModal.test.tsx` for action handoffs. Include each created test in the targeted run. Use `./node_modules/.bin/eslint <changed TypeScript file paths> --quiet` during individual tasks; the full lint/check commands above remain the integration gate.

Plan review: independent checker found no blocking omissions; its reproducible-command recommendation is incorporated above. This is a plan-quality review, not runtime verification.
