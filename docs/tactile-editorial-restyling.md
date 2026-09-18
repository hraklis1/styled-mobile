# Tactile editorial restyling

Implemented September 18, 2026. Changes are on `main`, uncommitted and unpushed.

## Design critique and response

1. **Contrast:** Home's near-matching ivory surfaces made its entry points look like content. An obsidian stylist capsule and white closet card now establish a clear action hierarchy over warm stone.
2. **Depth:** Reserve ambient shadows for action cards and primary controls. Brief rows and profile groups use white surfaces and fine edges; garment imagery retains its existing presentation.
3. **Typography:** Preserve Newsreader headings, strengthen UI labels, and use smaller tabular sans-serif priority numbers. Secondary copy has its own readable ink color.
4. **Affordance:** Secondary buttons, search, filters, disclosure icons, and utility actions receive defined containers, clearer contrast, and enlarged touch targets. Brief navigation and skip controls are siblings rather than nested pressables.

## Implementation

The existing TypeScript/StyleSheet theme remains the single source of truth. No dependency, backend contract, route, authentication, or subscription changes were needed.

- `src/components/home/AskStylistButton.tsx`: typed `onPress`, `disabled`, and layout `style` props. A 56pt-minimum obsidian capsule opens the same stylist flow. Its label wraps with large text.
- `src/components/home/AddToClosetCard.tsx`: the same small prop contract; 88pt-minimum elevated surface, 48pt icon tile, title, subtitle, and disclosure indicator. Opens the existing add flow.
- `src/components/shopping/ShoppingPriorityRow.tsx`: preserves existing props and data formatting. Full rows use a defined white surface; compact teaser rows remain flat. Skip has separate focus/activation, disabled/busy semantics, and its own pill.
- `PressableScale` adds optional `pressedContentStyle`, preserving existing defaults. Updated action components use crisp 0.985 press scaling plus visible surface feedback, including when Reduce Motion disables the scale.
- Shared buttons, search, inputs, section actions, grouped cards, selection controls, and editing controls adopt the new treatment. Local overrides were corrected across Home, Closet, boards, shopping, stylist, calendar, profile, onboarding, and sheets.
- Audited explicit undersized interactive styles were raised to at least 44pt. Compact overlay controls with sufficient hitSlop retain their visual size. Attachment removal now has 12pt hitSlop around its 20pt badge.
- Large-text headers and section actions stack; Home moves the profile control above the full-width greeting. Tab labels scale up to 1.4× and fit their fixed five-column bar, while preserving full accessibility names.

### Tokens

| Role | Value |
| --- | --- |
| Canvas | `#F6F5F2` |
| Elevated surface | `#FFFFFF` |
| Subtle / selected surface | `#EFEEE9` / `#E5E3DC` |
| Primary ink / inverse ink | `#242422` / `#FFFFFF` |
| Secondary / tertiary ink | `#625F59` / `#76716A` |
| Separator / control outline | `#DEDCD6` / `#8A857C` |
| Pressed primary surface | `#3A3A37` |
| Spacing scale | `4, 8, 12, 16, 24, 32, 48`; prompt inset `20` |
| Page gutter / section gap | `24` / `32` |
| Card / field / pill radius | `18` / `12` / `9999` |
| UI label | `14/20`, weight `600`, tracking `0.1` |
| Supporting copy | `13/19`, weight `400` |
| Metadata | `12/17`, tracking `0.2` |

| Shadow preset | shadowColor | shadowOffset | shadowOpacity | shadowRadius | elevation |
| --- | --- | --- | --- | --- | --- |
| control | `#242422` | `{ width: 0, height: 2 }` | `0.06` | `4` | `1` |
| actionCard | `#242422` | `{ width: 0, height: 4 }` | `0.08` | `12` | `3` |

New shadow-bearing surfaces do not clip their shadows. Existing image-specific and dark camera palettes remain independent.

## Verification

- `npm run check`: type checking and lint passed; **64 test suites, 471 tests passed**.
- `npm run ios`: native build succeeded with **zero errors and zero warnings**; reused the verified running Metro server.
- Six focused interaction cases cover launcher callbacks/disabled semantics, independent brief open/skip actions, pending-to-retry behavior, compact teaser behavior, and pressed feedback with Reduce Motion.
- Existing responsive layout coverage exercises 320pt/375pt widths and 1.6×/2× text. Expanded assertions prevent large-text headings from retaining a line clamp.
- Contrast calculations: primary ink on canvas **14.26:1**; white on obsidian **15.55:1**; secondary ink on white **6.36:1**, on canvas **5.84:1**; tertiary numerals on white **4.84:1**; input outline on white **3.67:1**.

### Simulator observations

Verified on iPhone 17 / iOS 26.5:

| Area | Observed result |
| --- | --- |
| Home | Dark prompt, elevated closet card, unclipped shadows; existing editorial image preserved |
| Stylist entry | Prompt opens the stylist; Done returns to Home; composer renders correctly |
| Add to closet | Opens the existing photo/import/manual-entry sheet |
| Shop | Shopping Mode now renders as a visible secondary pill |
| Brief | White rows and independent skip buttons appear in the accessibility tree; opening a priority reaches its shopping edit |
| Shopping edit | Loading state and loaded directions render correctly |
| Closet search | Entered a no-match query; empty state appeared; Clear restored 39 pieces |
| Item / outfit details | Existing media retained; primary actions and utility controls render correctly |
| Boards | Collection and a long-title board detail render correctly |
| Calendar | Overview, event details, and new-event form inspected; form dismissed without saving |
| Profile | White grouped surfaces, selections, inputs, and disabled save state inspected; dismissed without saving |
| Shortlist / shopping lightbox | Filters, visit rows, media, and piece actions inspected |
| Camera | Dark unavailable-camera state and library alternative render correctly; returned without capturing |
| Large text | Raised system text five steps; new Home components wrap after reload; corrected heading truncation and tab labels; restored original text size |

### Limits and remaining checks

This is not a claim that every app state has received visual verification.

- The simulator showed stale text measurements immediately after a live text-size change. A full app reload remeasured correctly. Live Dynamic Type changes still need device-level follow-up.
- Large-text Home was visually verified; the brief header was inspected at large text, but its lower rows were not visually confirmed because automated scrolling did not advance the simulator surface reliably.
- Authentication/onboarding screens and every secondary editor were not opened in this signed-in session. They inherit the updated shared styles, with onboarding-specific touch-target adjustments.
- Full VoiceOver traversal/audio, narrow-device screenshots, Android rendering, and real-device release animation/haptic feel remain unverified. Accessibility labels, separate brief actions, and Reduce Motion behavior were checked through the accessibility tree and focused tests.
- Physical camera capture is unavailable in this simulator. Offline and network-failure screenshots were not exercised. Skip pending/retry behavior was checked at the component boundary; no live suggestions were dismissed to test network mutations.

Screenshot artifacts accompany the task: `home-before.png`, `home-after.png`, `brief-after.png`, and `home-large-text.png`.
