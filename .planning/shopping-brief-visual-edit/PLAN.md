---
phase: shopping-brief-visual-edit
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/app/ShoppingPriorityEditScreen.tsx
  - src/components/shopping/ShoppingPriorityTargetCard.tsx
  - src/lib/shoppingPriorityEdit.ts
  - src/lib/__tests__/shoppingPriorityEdit.test.ts
autonomous: true
requirements:
  - SHOP-UI-01
  - SHOP-UI-02
  - SHOP-UI-03
  - SHOP-UI-04
  - SHOP-UI-05
must_haves:
  truths:
    - "Each shopping direction reads as a discrete premium object, with white inset cards separated by the app's warm ivory page ground."
    - "The complete rationale is more prominent than lookup metadata and is never line-clamped."
    - "Color, material, budget, silhouette, retailer guidance, and wardrobe pairings remain available without opening an accordion."
    - "The wardrobe-gap introduction is grammatically complete, concise, and does not repeat the same explanation across the masthead and context band."
    - "The direction count comes from response data, the compact header communicates scroll progress, and saving ends the page with a labeled action."
    - "Loading, error, no-buy, reconciliation, persistence, and existing non-toggle analytics behavior remain unchanged."
  artifacts:
    - path: "src/components/shopping/ShoppingPriorityTargetCard.tsx"
      provides: "Inset editorial direction card with rationale-first hierarchy, inline specs, always-visible evidence, and consistent wardrobe imagery"
    - path: "src/screens/app/ShoppingPriorityEditScreen.tsx"
      provides: "De-duplicated page composition, data-derived section chrome, compact-header progress, and closing save band"
    - path: "src/lib/shoppingPriorityEdit.ts"
      provides: "Pure presentation formatter for priority label/context copy"
      exports: ["shoppingPriorityGapStatement"]
    - path: "src/lib/__tests__/shoppingPriorityEdit.test.ts"
      provides: "Regression coverage for concise gap copy and the unchanged response contract"
  key_links:
    - from: "src/screens/app/ShoppingPriorityEditScreen.tsx"
      to: "src/components/shopping/ShoppingPriorityTargetCard.tsx"
      via: "A simplified target/index/wardrobe prop contract with no expansion state"
      pattern: "ShoppingPriorityTargetCard"
    - from: "src/components/shopping/ShoppingPriorityTargetCard.tsx"
      to: "src/lib/colorUtils.ts"
      via: "getSwatchColor(target.color), never an untrusted free-form string used directly as a React Native color"
      pattern: "getSwatchColor"
    - from: "src/components/shopping/ShoppingPriorityTargetCard.tsx"
      to: "src/lib/itemImage.ts"
      via: "itemCoverPresentation for uniform original, polished, and cutout treatment"
      pattern: "itemCoverPresentation"
    - from: "src/components/shopping/ShoppingPriorityTargetCard.tsx"
      to: "src/theme/index.ts"
      via: "cutoutScaleFor supplies the category-aware inset for cutout assets"
      pattern: "cutoutScaleFor"
    - from: "src/screens/app/ShoppingPriorityEditScreen.tsx"
      to: "src/lib/shoppingPriorityEdit.ts"
      via: "shoppingPriorityGapStatement builds the single wardrobe-gap statement"
      pattern: "shoppingPriorityGapStatement"
    - from: "src/screens/app/ShoppingPriorityEditScreen.tsx"
      to: "src/hooks/useWishlist.ts"
      via: "The labeled footer action reuses the existing saveEdit/addOutfitToWishlist path"
      pattern: "addOutfitToWishlist"
---

<objective>
Restyle the ready-state Shopping Priority Edit screen into a premium, rationale-led Shopping Brief edit without changing its API, navigation, save semantics, or non-ready states.

Purpose: Make three garment directions easy to scan as separate objects, make the reasoning and wardrobe evidence immediately legible, remove duplicated editorial copy and settings-like disclosure furniture, and give the page a clear conclusion.

Output: A tested copy formatter, a redesigned target card, and a reorganized ready-state screen using only the existing theme, image, animation, wishlist, and analytics infrastructure.
</objective>

<execution_context>
Before any production edit, read `AGENTS.md` and the exact Expo SDK 56 documentation relevant to the existing `expo-image` usage: https://docs.expo.dev/versions/v56.0.0/sdk/image/ . Do not add or update packages. Work directly on `main`, but do not commit or push unless the user explicitly asks.
</execution_context>

<context>
@AGENTS.md
@src/screens/app/ShoppingPriorityEditScreen.tsx
@src/components/shopping/ShoppingPriorityTargetCard.tsx
@src/components/shopping/ShopSubpageHeader.tsx
@src/components/primitives/PressableScale.tsx
@src/components/wardrobe/garment-image.tsx
@src/lib/shoppingPriorityEdit.ts
@src/lib/__tests__/shoppingPriorityEdit.test.ts
@src/lib/shopDecisionWorkspace.ts
@src/lib/colorUtils.ts
@src/lib/itemImage.ts
@src/hooks/useShoppingPriorityEdit.ts
@src/hooks/useWishlist.ts
@src/lib/analytics.ts
@src/theme/index.ts
@src/types/item.ts

<interfaces>
Existing contracts that must not change:

- `ShoppingPriorityTarget` contains `key`, `title`, `category`, `color`, `material`, `silhouette`, `priceRange`, `retailerExamples`, `rationale`, `unlocks`, and `pairsWithItemIds`.
- A ready `ShoppingPriorityEdit` contains exactly three targets; a no-buy edit contains none. Preserve `parseShoppingPriorityEdit` validation.
- `ShoppingPriorityEditScreen` receives the original `ShoppingBriefPriority`, `source`, `origin`, and `briefGeneratedAt` route parameters.
- `itemCoverPresentation(item, { preferThumb: true })` returns the selected URI, variant, content fit, and catalog-style status. `cutoutScaleFor(category)` supplies the established category-aware cutout scale.
- `getSwatchColor(name)` safely resolves free-form color copy to one or two known hex values with a neutral fallback.
- `saveEdit` currently builds a `ShopOutfit`, calls `addOutfitToWishlist`, maintains saving/saved/toast state, and emits `shopping_brief_edit_saved` or `shopping_brief_edit_save_failed`.
- `ShopSubpageHeader` already accepts a compact subtitle; use that capability for progress without changing the shared header component.
</interfaces>
</context>

## Requirements

- **SHOP-UI-01 — Premium hierarchy:** Use the existing warm ivory, atelier taupe, Bodoni display face, spacing, radii, hairlines, and shadow tokens to produce a calm fashion-editorial hierarchy.
- **SHOP-UI-02 — Reasoning first:** Show every target's full rationale at readable body size before secondary facts.
- **SHOP-UI-03 — Scannable evidence:** Keep specifications and wardrobe pairings visible and visually consistent without a settings-style disclosure row.
- **SHOP-UI-04 — Clear sections and conclusion:** Reduce repeated setup copy, derive counts from data, identify the current direction while scrolling, and finish with an explicit save action.
- **SHOP-UI-05 — Behavioral fidelity:** Preserve response parsing, route inputs, wishlist persistence, retry/error/no-buy behavior, reduced-motion handling, and the applicable analytics events.

## Locked visual and interaction decisions

- **D-01:** Use inset editorial cards: `colors.surfaceElevated` on `colors.background`, `radii.xl`, `borderCurve: 'continuous'`, a warm hairline, and `shadows.xs`. Do not return to full-bleed bands or rely on repeated top/bottom rules to separate targets.
- **D-02:** Replace the left `Look 01` rail with a compact `Direction 01` eyebrow above the card title. Render `target.rationale` at `typography.size.md`, approximately 22pt line height, `colors.inkSubtle`, and no `numberOfLines` clamp.
- **D-03:** Replace the three-column metadata grid with one quiet spec row: resolved color swatch plus color and material on the left; budget right-aligned and semibold. Keep labels available to accessibility even when visual labels are compressed.
- **D-04:** The ready masthead carries the edit title but no duplicate subtitle. The wardrobe-gap panel carries one statement built from `priority.label` and `priority.context`, followed by the priority-level unlocks once.
- **D-05:** Remove the target accordion. Show silhouette and retailer guidance as quiet inline details and show each target's wardrobe pairing thumbnails by default. Do not render the target-level `unlocks` line because the page already states the priority-level outcome.
- **D-06:** Present wardrobe thumbnails on the same uniform subtle ground and with the same original/polished/cutout rules used elsewhere. Resolve assets through `itemCoverPresentation`; scale cutouts with `cutoutScaleFor`; retain fallback icons, caching, recycling keys, and image-failure fallback.
- **D-07:** Replace the oversized hardcoded `03` block with a slim ruled section marker whose count is `data.targets.length`. All visible target numbering and compact progress are data-derived.
- **D-08:** Replace the glyph-only header save affordance with a closing save band after the third card. Its full-width primary button reads `Save this edit`, exposes busy state while saving, reads `Saved` when complete, and reuses the existing save callback and toast.
- **D-09:** Keep the compact sticky header, but give it contextual subtitle text: before the first card, `{count} curated directions`; while cards cross the compact-header reading line, `Direction {current} of {count}`.
- **D-10:** Preserve the ready/no-buy contract, route parameters, wishlist payload, save guards, toast, retry behavior, and all current analytics except `shopping_brief_edit_target_toggled`, which disappears with the removed interaction. Do not create a replacement event merely for scrolling or viewing static content.
- **D-11:** Do not add a second above-fold wardrobe thumbnail rail. Always-visible, target-specific pairings supply the requested imagery without duplicating proof or crowding the wardrobe-gap panel.
- **D-12:** Keep touch targets at least 44pt, honor `useReducedMotion`, expose explicit accessible labels/states on the save control, and keep decorative imagery hidden from the accessibility tree while preserving readable pairing names.

## Dependency graph and execution order

| Task | Needs | Creates | Wave |
|---|---|---|---|
| 1. Normalize the wardrobe-gap statement | Existing priority label/context contract | Tested `shoppingPriorityGapStatement` export | 1 |
| 2. Rebuild the target card hierarchy | Existing target/item/image/color contracts | New static card prop contract and visual hierarchy | 1 |
| 3. Recompose the ready screen | Tasks 1 and 2 | De-duplicated composition, scroll progress, and footer save action | 2 |

Tasks 1 and 2 touch disjoint files and may be implemented in either order. Task 3 must follow both because it imports the formatter and consumes the simplified card interface.

<tasks>

<task type="tdd">
  <name>Task 1: Add the concise wardrobe-gap presentation contract</name>
  <files>src/lib/shoppingPriorityEdit.ts, src/lib/__tests__/shoppingPriorityEdit.test.ts</files>
  <behavior>
    - Fragment case: `formal shirt or blouse` plus `to meet the formal dress code.` becomes `Formal shirt or blouse to meet the formal dress code.` per D-04.
    - Sentence case: a label plus an already complete, capitalized context becomes two grammatical clauses in one text block, without changing the context's words.
    - Whitespace case: repeated whitespace and empty context are normalized; an empty context falls back to the sentence-cased label.
    - Contract regression: the existing exact-three ready targets, zero-target no-buy, updated-brief reconciliation, and headline fallback tests continue to pass per D-10.
  </behavior>
  <action>Add and export a pure `shoppingPriorityGapStatement(label: string, context: string): string`. Normalize whitespace. When the normalized context begins with a lowercase continuation, concatenate it after the sentence-cased label with one space; when it reads as an independent sentence, separate the label and context with sentence punctuation in the same returned text block; when context is empty, return the label. Write the tests before implementation and do not alter parsing or server data.</action>
  <verify>
    <automated>npm test -- --runTestsByPath src/lib/__tests__/shoppingPriorityEdit.test.ts</automated>
  </verify>
  <done>The formatter makes the screenshot's fragment copy grammatical, handles complete contexts predictably, and every existing response-contract test still passes.</done>
</task>

<task type="auto">
  <name>Task 2: Turn each target into a rationale-led editorial card</name>
  <files>src/components/shopping/ShoppingPriorityTargetCard.tsx, src/screens/app/ShoppingPriorityEditScreen.tsx</files>
  <action>Implement D-01, D-02, D-03, D-05, D-06, D-07, and D-12 in one self-contained card refactor. Simplify `Props` to `target`, `index`, and `wardrobe`; remove `expanded`, `onToggle`, disclosure state, chevron animation, layout transition, and duplicated target unlocks. In `ShoppingPriorityEditScreen`, migrate the caller in the same task: remove `expandedTargetKey`, `toggleTarget`, and the `shopping_brief_edit_target_toggled` call, and render each card with only the simplified props. This keeps the repository type-correct at the Task 2 boundary. Use `Direction NN` as the eyebrow, retain the serif title, promote the complete rationale, then render the compact spec row. Resolve swatches with `getSwatchColor(target.color)` and render the existing two-half treatment when its optional secondary color is present rather than passing model text directly to `backgroundColor`. Show silhouette and `retailerExamples` as quiet labeled lines, retaining explicit accessible labels for the compressed specs. When `pairsWithItemIds` is non-empty, render the pairing rail directly; resolve each ID against the wearable map, keep its supplied ID as the stable key, show a graceful fallback for missing items, and keep names at least `typography.size.xs`. For images, use `itemCoverPresentation(item, { preferThumb: true })`, `cutoutScaleFor(item.category)`, `contentPosition="center"`, `cachePolicy="memory-disk"`, and a per-item recycling key so original photos crop, catalog-style assets contain, and cutouts receive consistent air. Preserve the existing `onError` fallback and explicitly hide each decorative image/placeholder from the accessibility tree while leaving the adjacent pairing name readable. Keep the card readable when retailer arrays or pairing arrays are empty. Use existing tokens and `shadows.xs`; do not add local off-palette colors except the existing image-frame hairline convention.</action>
  <verify>
    <automated>npm run typecheck &amp;&amp; ./node_modules/.bin/eslint src/components/shopping/ShoppingPriorityTargetCard.tsx --quiet</automated>
  </verify>
  <done>Each direction is a distinct inset card; rationale dominates; specs remain scannable; silhouette, retailers, and pairings are visible with no tap; all imagery uses established wardrobe presentation rules; the component and its screen caller have no disclosure-only props or state; and the repository typecheck passes at this task boundary.</done>
</task>

<task type="auto">
  <name>Task 3: Recompose the ready screen and make saving the conclusion</name>
  <files>src/screens/app/ShoppingPriorityEditScreen.tsx</files>
  <action>Implement D-04, D-07, D-08, D-09, D-10, D-11, and D-12 while leaving loading, error, both no-buy branches, and their copy/controls intact. In the ready branch, use the Task 1 formatter for a single wardrobe-gap statement and remove the ready header subtitle. Restyle the gap block as one calm, well-demarcated editorial band containing the eyebrow, statement, and one unlock row. Replace the 92pt hardcoded section header with a slim top rule, data-derived two-digit count, `Curated directions`, and no redundant `Three distinct ways...` sentence. Render the simplified cards with generous ivory space between them and no negative full-bleed card margins.

For compact progress, retain `showCompactHeader`, keep per-target layout offsets in a ref, reset offsets/progress when `generatedAt` changes, and update only when the current index actually changes. Compare scroll position plus compact-header height against recorded card offsets; show `{count} curated directions` before the first threshold and `Direction NN of NN` afterward. Do not emit analytics for this passive progress.

After the target list, add a closing white editorial band with one short destination line such as `Keep these directions in Saved Shopping.` and a full-width `PressableScale` button. Convert `SaveEditAction` into a labeled control suitable for this band or replace it with an equivalently named local component; preserve `saveEdit`, `isSaved`, `saving`, the wishlist payload, the 44pt minimum, `accessibilityState`, failure alert, and existing toast. Remove the header action from both regular and compact headers so saving is presented once, at the natural end of review.</action>
  <verify>
    <automated>npm run check</automated>
    <human-check>Run `npm run ios`, open Shop → Shopping Brief → See options, and perform the visual/interaction checklist below on a compact iPhone simulator and the default simulator.</human-check>
  </verify>
  <done>The ready screen has one concise setup block, a data-derived section marker, three separated rationale-led cards, meaningful compact progress, and one unmistakable closing save action; all non-ready paths and persistence behavior still work.</done>
</task>

</tasks>

## Visual and interaction acceptance checklist

1. At first paint, the masthead, wardrobe-gap panel, section marker, and first direction have clearly different hierarchy; adjacent white bands no longer merge into a news-column stack.
2. Every card has visible ivory gutter around it, continuous rounded corners, and subtle depth consistent with existing app cards. No doubled borders appear between cards.
3. `Direction 01/02/03` and the section count are derived from the returned targets. There is no hardcoded visible `03` and no `Look` label.
4. Long rationales wrap fully at readable contrast and size. Color/material/budget never visually outrank them; narrow screens do not clip the price or collapse the descriptive spec text into unreadable columns.
5. A color such as `light gray`, a compound or patterned color, and an unknown color all produce a safe swatch. The unknown value falls back through `getSwatchColor`; no invalid React Native style warning appears.
6. Pairings are visible without tapping. Original lifestyle photos fill their frames, polished/cutout assets sit on the same subtle ground with consistent air, missing items show a quiet fallback, and item names remain legible.
7. The page does not repeat the generated summary, priority context, priority unlocks, or pairing count. Silhouette and retailer guidance appear once per direction.
8. As the page scrolls, the compact header appears without jumping. Its subtitle changes from the total direction count to the current `Direction NN of NN`; reduce-motion mode suppresses entrance/exit motion as it does today.
9. The final band contains one clearly labeled save button. One tap triggers the existing haptic/save path, announces busy state, becomes `Saved`, shows the existing toast, and prevents duplicate writes. A failed save still shows the existing alert and analytics event.
10. Back navigation, retry, no-buy, reconciled no-buy, and Saved Shopping persistence behave exactly as before. VoiceOver reads the gap statement, direction title/rationale, labeled specs, pairing names, and save state in a sensible order; decorative images are skipped.

<threat_model>

## Trust Boundaries

| Boundary | Description |
|---|---|
| API response → React Native styles | Target copy, including color names, is model-generated/free-form and must not be trusted as a valid style value. |
| Local wardrobe cache → image renderer | Item IDs and image URIs may be missing or stale; the visual layer must fail closed to the existing placeholder. |
| UI → wishlist/analytics | Save presses cross into persistent local/server state and telemetry; this plan must reuse existing guarded paths. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-SBE-01 | Tampering | `ShoppingPriorityTargetCard` swatch | mitigate | Resolve model color copy through `getSwatchColor`; never use `target.color` directly as a style value. |
| T-SBE-02 | Denial of Service | Pairing image resolution | mitigate | Preserve missing-item and image-error fallbacks, bounded three-item rows from the server contract, thumbnail preference, cache policy, and recycling keys. |
| T-SBE-03 | Repudiation | Footer save action | mitigate | Reuse the existing save guard and success/failure analytics; do not create a second persistence path. |
| T-SBE-04 | Information Disclosure | Wardrobe pairings | accept | The same authenticated user's wardrobe items are already intentionally returned as pairing IDs and displayed on this screen; the redesign changes visibility, not data access. |
| T-SBE-SC | Tampering | Package supply chain | mitigate | No package-manager installs or dependency changes are permitted by this plan. |

</threat_model>

## Out of scope and explicit dispositions

- No backend, prompt, endpoint, query-key, response schema, navigation, entitlement, or wishlist model changes.
- No redesign of loading, error, retry, no-buy, or reconciled no-buy states; they receive regression verification only.
- No global theme-token changes and no shared `ShopSubpageHeader` API/style change. The current ready headline is already bounded by `shoppingPriorityEditDisplayHeadline`, so the global `maxWidth` note is not expanded into a cross-screen header refactor.
- No separate wardrobe-image strip in the page introduction per D-11; it would repeat the same target-specific evidence and work against the minimalist goal.
- No expansion scroll anchoring. Removing expansion per D-05 eliminates the layout jump that required it.
- No new impressions, progress, or image-view analytics. The obsolete toggle event is removed with its interaction; open/load/failure/retry/save analytics retain their current names and property shapes.
- No retailer links, product search, buying flow, per-direction selection, target editing, or save-destination navigation.

## Multi-source coverage audit

| Source type | Source item | Disposition | Plan coverage |
|---|---|---|---|
| GOAL | Premium fashion-app feel with minimalist, readable layout | COVERED | D-01, D-02; Tasks 2–3; checklist 1–4 |
| GOAL | Rationale must be especially clear | COVERED | SHOP-UI-02, D-02; Task 2 |
| GOAL | Avoid news-column density and walls of text | COVERED | D-01, D-04, D-05, D-07; Tasks 2–3 |
| GOAL | Sections visibly demarcated | COVERED | D-01, D-07; Tasks 2–3 |
| GOAL | Follow existing design language and colors | COVERED | SHOP-UI-01, D-01, D-06; Task 2 |
| REQ | Hierarchical separators/cards | COVERED | SHOP-UI-01, D-01 |
| REQ | Promote unclamped rationale | COVERED | SHOP-UI-02, D-02 |
| REQ | Collapse metadata into spec line with color swatch and emphasized price | COVERED | SHOP-UI-03, D-03 |
| REQ | Remove duplicated/broken copy | COVERED | D-04; Task 1 and Task 3 |
| REQ | Replace disclosure and surface pairings | COVERED | D-05, D-06; Task 2 |
| REQ | Add imagery earlier in the reading flow | COVERED | D-05 exposes target pairings immediately; D-11 records why a duplicate intro rail is excluded |
| REQ | Close page with explicit save action | COVERED | D-08; Task 3 |
| REQ | Derive count and use Direction vocabulary | COVERED | D-07; Tasks 2–3 |
| REQ | Prevent expansion-induced scroll displacement | EXCLUDED | D-05 removes expansion, so the failure mode no longer exists |
| REQ | Add compact-header progress | COVERED | D-09; Task 3 |
| REQ | Address fixed header-title width | EXCLUDED | Existing `shoppingPriorityEditDisplayHeadline` bounds this screen; changing shared header geometry would expand scope to unrelated Shop pages |
| RESEARCH | No separate research artifact supplied; established codebase patterns were inspected | COVERED | Existing `theme`, `colorUtils`, `itemImage`, `GarmentImage`, `PressableScale`, analytics, and tests are named in context and actions |
| CONTEXT | Preserve current app color/design language and important information | COVERED | D-01 through D-10 |
| CONTEXT | Prioritize pairing evidence without overcrowding | COVERED | D-05, D-06, D-11 |
| CONTEXT | Keep suggestions only within a UI edit | COVERED | D-10 and Out of scope |

No source item is silently omitted. The two excluded implementation notes are resolved by existing constraints or by removal of the underlying interaction, not deferred as unfinished scope.

<verification>

- `npm test -- --runTestsByPath src/lib/__tests__/shoppingPriorityEdit.test.ts`
- `npm run typecheck`
- `./node_modules/.bin/eslint src/screens/app/ShoppingPriorityEditScreen.tsx src/components/shopping/ShoppingPriorityTargetCard.tsx src/lib/shoppingPriorityEdit.ts src/lib/__tests__/shoppingPriorityEdit.test.ts --quiet`
- `npm run check`
- `npm run ios` followed by the ten-item visual and interaction checklist above
</verification>

<success_criteria>

- All five local requirements and all locked decisions D-01 through D-12 are implemented.
- The ready page is visually calmer and card-based, with rationale and pairing proof readable without interaction.
- Visible counts, direction labels, and compact progress are driven by the three-target response rather than literals.
- Saving is a labeled conclusion and retains the exact existing persistence, error, toast, and analytics semantics.
- The targeted test, typecheck, lint, and full project check pass.
- Simulator verification passes on a compact iPhone size, the default simulator size, VoiceOver reading order, and Reduce Motion.
</success_criteria>

<output>
When implementation is complete, leave changes staged or unstaged on `main` and report the verification results. Do not commit or push without an explicit user request.
</output>
