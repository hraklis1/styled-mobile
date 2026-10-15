# Batch Review Redesign

Branch: `batch-review-redesign` (an experiment branch: commit as you go, never push without asking).

## Goal

Make the batch Add Clothes flow use the same design language as the single-photo scan.
A batch should read as **several single scans stacked**: the photo as a map, numbered
markers, compact rows. Fewer stages, a single primary button that keeps its wording,
and loading states that show real data.

## Today (baseline)

| Stage | Single scan | Batch |
|---|---|---|
| `scanning` | `DetectionState` hero | Same hero + filmstrip; portrait photo letterboxed in a landscape frame; copy says "outfit" |
| `pre-extract` | `PhotoReview` (photo + numbered markers + `PieceRow`s) | `PreExtractGrid` 2-up `GridCard`s + tip banner ("Choose pieces") |
| `extracting` | Extraction hero | Full-screen "Refining your pieces" hero showing an upscaled crop |
| `review` | `PhotoReview` | `PreExtractGrid` again ("Review details") |
| footer | `ActionBar` | Polish row + changing primary label + "Add all N now" link |

The split is at `scan-review-workspace.tsx` around line 222. If every piece
shares one `cropSource`, the workspace uses `PhotoReview`; otherwise it falls back
to the contact sheet. **`cropSource` already identifies each piece's photo**, so
grouping by photo needs no backend change.

## Design principles

1. One vocabulary: marker numbers, `PieceRow`, the "Check" dot, `MarkedPhoto`, and `GuidedFooter` loupe.
2. Photo = map. A piece is never shown without its photo nearby.
3. One review surface. The batch doesn't make users walk through near-duplicate screens.
4. One button with stable wording. Flags are inline, not a gate that relabels the button.
5. Motion only when something real happens.

---

## Phase 0: Groundwork (no visual change)

- `src/lib/scan-review.ts`: add `groupPiecesByPhoto(pieces)` → `{ source, pieces, numbers }[]`,
  in batch photo order (first appearance), with stable numbering. Decide on numbering:
  **per-photo numbers (1..n inside each section)**, labelled "2·3" in cross-photo notes
  (for example, "Possibly same as 2·3"). Unit test it.
- Cross-photo duplicate detection: `possibleDuplicate` already compares by category and name; make
  `noteFor` render the photo-qualified reference.
- `MarkedPhoto`: confirm the compact mode works at ~120pt height and with a tap-to-expand
  (full-width) state. Add a `size="thumb" | "compact" | "full"` prop if needed.
- Snapshot the current batch flow in the sim (screens 1–11) for before/after.

**Done when:** helpers are tested and typecheck is clean.

## Phase 1: Grouped review by photo (the biggest win)

New `src/components/wardrobe/scan-review/PhotoSections.tsx`:

- A `SectionList` (or a `FlatList` with flattened items for perf) of photo sections.
- **Section header**: `MarkedPhoto` (compact, ~140pt, its own aspect ratio, rounded `radii.lg`)
  with numbered markers; to the right/below, "Photo 2 of 3" eyebrow + "4 pieces · 1 to check".
  Tapping the photo expands it inline (animated height); tapping a marker scrolls to and
  highlights its row (reuse `activeId` / `onActivate` from `PhotoReview`).
- **Rows**: the existing `PieceRow` (same component as single scan), so brand, check dot,
  include toggle and duplicate note come along for free.
- Duplicates per section are collapsed at the section's end, as in `PhotoReview`.
- **Sticky filmstrip** under the header (reuse `FilmFrame` filmstrip from `LoadingStates`):
  shows the current section and taps to scroll to a section. It hides for batches with only 1 photo.
- Wire into `scan-review-workspace.tsx`: when `reviewPhoto === null` and there are ≥2 sources,
  render `PhotoSections` instead of `PreExtractGrid` for both `pre-extract` and `review`.
- Keep `PreExtractGrid` as an optional **grid view** toggle in the header (`⋯` menu → "View as grid"),
  persisted per user in AsyncStorage. Default: sections.
- Remove the "Know a brand?" tip banner; the row's ghost "Add brand" explains itself.

**Done when:** a 3-photo/12-piece batch reviews in sections in the sim; markers ↔ rows link;
grid toggle still works; `ingestion-workspace.test.tsx` updated.

## Phase 2: Row and visual polish

- `PieceRow` tweaks (shared, so single scan benefits too):
  - 64–72pt thumbnail; never upscale a tiny crop beyond its natural size (center it in the
    well with `contentFit="contain"` and a max scale), which fixes the blurry eyeglasses.
  - Title up to 2 lines, no mid-word truncation; metadata line "Bottoms · Grey · Wool" in `typography.caption`.
  - Brand: plain small-caps text when set; faint "Add brand" ghost when empty (no dashed pill).
  - Excluded: row at 45% opacity + hollow marker (matches `PhotoMark.off`), and no per-card check badge.
  - Reading state: a shimmer on the metadata line while `extraction === 'running'`.
- `GridCard` (for the grid view): lighter surface, smaller badge, same brand treatment, so both
  views match.

**Done when:** single scan and batch rows are pixel-identical in the sim.

## Phase 3: Merge Choose and Review into one surface

- In batch mode, `pre-extract` → `review` becomes **in-place**: no full-screen `extracting` hero.
  The sections stay up; rows of pieces being read shimmer and resolve one by one (detail lines
  fade in, check dots appear).
- Header title: "Your pieces" throughout, plus a thin progress hairline under the header while
  extraction runs ("Reading 5 of 12").
- Extraction auto-starts for included pieces as soon as detection for a photo completes (batch only),
  so the user can choose and brand while reading happens. Excluding a piece cancels or ignores its
  extraction (check `runner.ts` / `steps.ts` for a cancellation path; if there isn't one, skip
  saving its result). **Cost check**: auto-extracting pieces the user would later exclude costs
  credits; gate it so pieces auto-extract only when there are ≤20 pieces per photo, or include
  them by default. Confirm with the user.
- Brand edits before extraction still feed the extraction (existing behaviour of `+ Brand`).
- Minimise to tray keeps working; the tray copy reflects "Reading 5 of 12".
- Analytics: keep `scan_review_extraction_approved` firing (now "auto") so funnels don't break; add `trigger: 'auto'`.

**Done when:** a batch goes detect → one review surface → save with no intermediate screen.

## Phase 4: Inline flags + stable primary button + calm footer

- `ActionBar` in batch mode:
  - Primary: **"Add 12 to closet"** always. If flags remain, the subtitle under the label reads
    "1 to check first". Tapping it starts the guided loupe over flagged pieces (existing
    `GuidedFooter` walk), whose last step reads "Add 12 to closet".
  - A long-press or `⋯` → "Add without checking" replaces the "Add all 12 now" link.
  - Polish collapses to a single chip row above the button: "✦ Polish 12 photos · 48 credits",
    a toggle chip plus a "See example" link. The credits balance shows only when it's low.
- The `All / To check · 1` segment moves into the sticky header and only shows when check > 0.
- The same footer is used in single scan (unification), behind no flag.

**Done when:** the button never changes wording mid-flow; the footer is ≤ 2 rows.

## Phase 5: Detection hero with real markers

- `DetectionState`: frame the photo at its own aspect ratio (measure via `Image` `onLoad`),
  removing the grey letterbox bars; cap height to the existing `heroHeight`.
- When a photo's detection resolves, animate its numbered markers popping in (staggered 60ms,
  spring scale 0.6→1, haptic `selection` per photo, not per marker), hold ~700ms, then
  advance the filmstrip with a crossfade. With reduce-motion on: no stagger, instant.
- The sweep stays only while that photo is genuinely pending.
- Copy: "Finding pieces · photo 2 of 3"; replace "outfit" wording in `SCAN_MESSAGES` for closet
  scans (the outfit logger keeps its own via `stepLabels`).
- The header count ticks up as pieces land: "7 pieces · 2 of 3 photos".
- Shared-element feel: on the last photo, the hero photo shrinks into section 1's header
  (Reanimated layout transition; fall back to a crossfade if shared transitions misbehave
  with expo-image).

**Done when:** the detection screen shows real markers and transitions into sections.

## Phase 6: QA, tests, cleanup

- Tests: `groupPiecesByPhoto`, section rendering, marker↔row linkage, the button label invariant,
  and auto-extract cancellation on exclude.
- Sim passes: 1-photo batch (should look like single scan), 3-photo/12-piece batch, 10-photo
  batch (perf: section list virtualisation, filmstrip scroll), a failed extraction, a duplicate
  across photos, polish on/off, minimise mid-read and restore, iPhone SE height, dynamic type XL,
  VoiceOver order (section header → rows).
- Remove dead paths: the tip banner, the batch use of the `extracting` hero, and the "Add all now" link.
- Update the memory notes and this doc's status.

## Decisions (Oct 15 2026)

- Extraction starts only after **Continue** (no auto-extract while choosing). Phase 3 keeps the
  single surface; it just doesn't spend credits until the user commits.
- Numbering is **per photo**; cross-photo references read "2·3".
- The footer is **unified**: single scan gets the Phase 4 footer too.

## Risks / open questions

1. ~~Auto-extract cost~~: resolved, extract after Continue.
2. Per-photo vs global numbering: per-photo is recommended (smaller numbers, matches single scan).
3. The shared footer change affects single scan; verify the single flow doesn't regress.
4. The Log Wear flow shares components (`LogOutfitSheet`, `GuidedFooter`); keep its labels intact.

## Status

- [x] Phase 0 (`groupPiecesByPhoto`, `pieceNumbering`, photo-qualified notes) · [ ] Phase 1 · [ ] Phase 2 · [ ] Phase 3 · [ ] Phase 4 · [ ] Phase 5 · [ ] Phase 6
