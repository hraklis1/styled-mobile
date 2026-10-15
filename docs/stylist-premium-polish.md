# Stylist premium polish

Goal: make the AI Stylist (tab, overlay, history, response cards, sheets) feel
modern and premium without changing the design ethos — warm stone canvas,
obsidian ink, Newsreader editorial serif, lookbook photography. Polish, not a
redesign. Assessed Oct 15 2026 from simulator screenshots + code.

Every phase is shippable on its own, sim-verified before moving on, and left
uncommitted until asked (AGENTS.md).

## Phase 1 — Correctness polish (things that read as bugs)

| # | Issue | Fix | Where |
|---|---|---|---|
| 1.1 | History previews show raw markdown (`**Go polished…**`) | Strip markdown on the client when rendering; also strip server-side so other clients get clean text | `ChatConversationDrawer.tsx`, `../Styled/server/routes.ts` (conversations list) |
| 1.2 | Calendar titles leak into prompts: `Dress me for "Regular \| VH " on…` | Normalise event titles (trim, collapse pipes/whitespace, drop quotes) before building the brief | `useEventStylistHandoff.ts` |
| 1.3 | History rows: every row "1d ago" under one `EARLIER` header; titles duplicated | Group by Today / Yesterday / weekday / date; show weekday+time on rows; clean titles of quotes/pipes | `ChatConversationDrawer.tsx` |
| 1.4 | Orphaned weather pill + ~100pt gap above the first day divider in a thread | Fold weather into the first day divider row or drop it in-thread | `StylistChatView.tsx` |
| 1.5 | Tapping the first history row sometimes leaves the empty state on screen | Investigate `selectConversation` early-return when the id equals the active (but unrendered) thread; reload instead of no-op when the screen is empty | `StylistChatView.tsx` |

## Phase 2 — Chrome & density

- 2.1 Compact header in-thread: large serif "Your stylist" + monogram only on
  the empty state; in a conversation, one-line centered small serif title.
  Animate between them on scroll / thread state.
- 2.2 Translucent chrome: `expo-blur` header and composer dock, `chromeTint`
  fallback for Reduce Transparency. Content scrolls under both.
- 2.3 Composer: single row when empty (`+` · input · mic), grows with text.
  Send button appears (scale+fade) only when there is text; no grey disabled disc.

## Phase 3 — Motion & feedback

- 3.1 Thinking state: replace `ActivityIndicator` with an italic serif status
  line that cross-fades between progress stages + a shimmering 2×2 look-grid
  skeleton when an outfit is expected.
- 3.2 Choreographed reveal: lede → collage tiles staggered ~60ms → rationale →
  actions. Respect `useReducedMotion`.
- 3.3 Haptics on save outfit, wore it, thumbs, swap, send, chip select.
- 3.4 Shared `PressableScale` primitive (0.97 spring) replacing
  `TouchableOpacity` on cards, rows and buttons in stylist surfaces.

## Phase 4 — Typography system adoption

- 4.1 Migrate all 21 stylist components from raw `Text` + literal `fontSize`
  to `AppText` roles (`typography.text.*`).
- 4.2 Eyebrow diet: caps only for section labels (THE LOOK, WHY IT WORKS);
  slot categories become sentence-case muted meta.
- 4.3 ~~Assistant lede rendered as an editorial standfirst~~ — DROPPED: the serif
  lede was deliberately removed in 2a47c32 (Oct 12, "conversation uses the body
  face throughout; editorial type is reserved for titles"). Not reverting it.
- 4.4 Sheet titles (attach, intake, item detail) use editorial serif.

## Phase 5 — Look card & surfaces

- 5.1 Collage: full-bleed, 4pt image radius, hairline frame instead of the
  white card; prefer cutout imagery over lifestyle photos in the grid.
- 5.2 Feedback thumbs move to the card footer beside Listen.
- 5.3 Single action row: Save (primary) · Wore it · Refine (equal secondaries).
- 5.4 Empty state: visual "Today's look" card (3 mini thumbs) + horizontal
  chips for Dress for a plan / Style a piece / More ideas.
- 5.5 Attach sheet: serif title, "From closet" label, icon weight parity.
- 5.6 History drawer: serif title, borderless tinted search, plain-text
  "New conversation", look thumbnail per row (needs server `lookThumb` in the
  list payload — backend change, deploy before app build).

## Verification

Each phase: `npx tsc --noEmit`, lint, then simulator screenshots of empty
state, history, an outfit thread, attach sheet. Reduced Motion + Reduce
Transparency spot-checks for phases 2–3.

## Status

- [x] Phase 1 — Oct 15 2026 (1.1 client + server strip; 1.4 folded weather into the compact header, see 2.1)
- [x] Phase 2 — Oct 15 2026: compact thread header; header + dock float over the thread with blur (solid `chromeTint` under Reduce Transparency, `useReduceTransparency` hook); one-row composer, send appears only with content, expands once the draft wraps
- [x] Phase 3 — Oct 15 2026: breathing walnut mark + italic serif stage line (cross-fades) + placeholder lines; `freshMessages` gates entrances so only live replies animate (history appears instantly); outfit card assembles in 5 beats via `Reveal`; PressableScale on Save/Wore it; tint-on-press idea rows; haptics on send, thumbs, idea rows. Outfit-card stagger not yet seen live (test reply came back as prose)
- [x] Phase 4 — Oct 15 2026: 86 borrowed `fontSize: role.fontSize` + hand-tuned lineHeights replaced with full roles (single-line inputs pinned with `inputLineHeight`); new `editorialBodyCompact` role; slot categories sentence-case meta; serif `editorialSheet` on drawer, rename, item, attach, intake, location and more-ideas titles. Raw `Text` kept (styles now carry roles; a mechanical `AppText` swap would be churn with no visual change)
- [x] Phase 5 — Oct 15 2026: 5.1 DROPPED (collage mat is deliberate, see ResolvedOutfitCollage; cutouts deliberately not covers, see itemImage.ts); thumbs moved to a "Right for you?" card footer; editorial refine actions are underlined text links (one filled + one outlined button per card); empty state leads with a "Style me today" card showing the most-worn top/bottom/shoes (catalog-style covers first); attach tile "From closet"; drawer has tinted borderless search, text "New conversation", look thumbnail + italic look name per row. Backend: `getStylistConversationLooks` + `lookName`/`lookItemIds` on GET /api/stylist/conversations (also markdown-stripped previews) — NOT DEPLOYED; app degrades to the old row without it

## Follow-up — landing page declutter (Oct 15 2026)

- Fixed: the empty state couldn't scroll to its end (`messageListEmpty` used
  `flex: 1`, which pins the content container to the viewport; now `flexGrow: 1`).
- Compact masthead everywhere (location · weather as its tappable subtitle);
  the large monogram header and the in-page location line are gone.
- Hero keeps one supporting line ("Styling from your N pieces"); the
  "START WITH AN IDEA" eyebrow is dropped; vertical rhythm tightened.
