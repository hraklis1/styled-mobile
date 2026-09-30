# Unified wardrobe ingestion

Both single-photo decomposition and multi-photo import use the same ScanReviewWorkspace and ingestion components. Existing extraction, retry, persistence and background-import adapters remain intact.

## Components and state

- PreExtractGrid renders the shared contact sheet before and after extraction. GridCard keeps photo inspection, inclusion, brand search and brand removal as separate sibling touch targets.
- The main grid Brand button opens brand search directly for all currently included pieces. ItemInspectionModal is inspection content inside the existing workspace modal, not a second native modal.
- BrandSearchSheet captures target IDs and commits once. The workspace checks that targets still exist and, during batch editing, remain included before applying.
- Legacy ContactSheet, IngestionGridCard and ItemInspectionView exports are compatibility aliases to the new components.

| Mode | Selection | Navigation and actions |
| --- | --- | --- |
| Grid | Circular inclusion control | Photo opens inspection; capsule opens search; cross clears brand |
| Inspection | Included/Skipped status switch | Swipe hero; accessible increment/decrement navigation |
| Brand search | Captured item IDs | Suggestion or custom name applies once; dismiss without change |
| Crop | Active piece | Apply or Cancel returns to the same inspection item |

The grid has one selection model: inclusion. Brand captures the currently included IDs and opens search directly, without an intermediate editing screen or second selection pass. It is disabled when nothing is included. Choosing a brand updates those pieces immediately and leaves inclusion, filter and scroll position unchanged. Removed or newly skipped targets are checked again before application. Individual capsules still tag or clear a single piece, including a skipped piece.

The batch edit dock is no longer mounted by the workspace. Its reusable component remains available, but Season and review confirmation are individual inspection actions in this simplified flow. Brand changes increment a revision so targeted mounted capsules animate even if the value is unchanged.

Normal single-photo review has one close control. Background imports have minimize and an overflow menu containing Discard import; discard retains confirmation. Newly submitted batches open full-screen by default and remain minimized only after an explicit minimize action. Grid extraction/save actions retain their existing behavior.

## Visual language and ergonomics

| Token | Value |
| --- | --- |
| Editorial typography | Newsreader regular/medium |
| Controls and metadata | System sans |
| Canvas | #F6F5F2 |
| Charcoal | #242422 |
| Warm gray | #625F59 |
| Image plate | #EFEEE9 |
| Border | #DEDCD6 |
| Photo corners | 2 pt |
| Input corners | 12 pt |
| Capsules and dock | Fully rounded |
| Inclusion transition | 160 ms |
| Brand feedback | 180 ms |

Excluded image containers transition to 0.45 opacity. An SVG saturation filter (0.65) crossfades over the original image, keeping color treatment confined to imagery. Captions and controls remain readable; there are no Excluded labels or selection disclaimers. A reserved 1 pt border prevents layout movement.

Brand label and clear actions have independent 44 pt minimum targets. Corner selection has a 48 pt target and bounded hitSlop. The grid toolbar offers Include/Exclude all and Brand above the extraction/save action.

Inspection uses a 3:4 hero. Photos cover the plate; cutouts remain contained on a warm neutral canvas. This does not alter saved crop coordinates. Crop opens the original source and current bounds. The crop pill uses expo-blur with an opaque Reduce Transparency fallback.

Swiping disables metadata edits until the page settles. A maximum seven-dot window communicates position; VoiceOver exposes an adjustable “Piece X of Y” control. Previous/Next links and tick scrubber are removed from inspection. Included/Skipped sits above the metadata block and does not navigate when changed.

## Keyboard and safe-area ownership

The full-screen workspace owns a KeyboardProvider. Inline inspection inputs use KeyboardAwareScrollView with bottomOffset equal to measured footerHeight plus spacing.md, interactive dismissal and handled keyboard taps.

Brand search stays at the large native detent. The native SwiftUI sheet retains keyboard safe-area handling; it does not ignore the keyboard region. RNHostView explicitly uses matchContents={false} so React Native receives the available native viewport. Search stays above a flex:1/minHeight:0 result list, with keyboardShouldPersistTaps="handled" and keyboardDismissMode="interactive". Search autofocus waits for its row layout.

Do not add another KeyboardAvoidingView, keyboard-height subtraction, or the outer workspace safe-area inset inside this native sheet. The platform owns its keyboard and safe-area resizing. Programmatic closing dismisses the keyboard and releases the sheet after completed native dismissal. Existing iOS and Android native adapters remain.

SDK reference: https://docs.expo.dev/versions/v56.0.0/sdk/keyboard-controller/

## Feedback and accessibility

- Inclusion, editing selection, individual brand changes and completed user paging: selection haptic.
- Bulk operations: one light impact, never one per item.
- Crop completion/failure: success/error notification haptic.
- Haptic failures do not block state updates.
- Reduce Motion suppresses scaling and navigation travel; inclusion state remains visible.
- Reduce Transparency replaces hero blur with opaque chrome.
- Header text can wrap; button targets do not shrink.

## Validation

Automated coverage includes inclusion/inspection/brand touch partitioning, brand clearing, empty/one/35-item grids, direct included-piece brand tagging, zero-selection disabling, preserved filters, stale targets, duplicate brand submissions, unchanged inclusion during metadata edits, swipe settlement, and crop apply/cancel/failure restoration. Existing single-photo and batch runner/store/retry tests cover extraction and persistence behavior.

The native iOS build succeeded and installed/opened on iPhone 17. The existing Metro server was verified running. Type checking and lint passed. All 74 tests across nine ingestion/review/batch suites passed. A production iOS JavaScript export also completed successfully.

Interactive validation is still required: the computer-control tool cannot resolve Simulator by bundle ID or its Xcode application path. Consequently no visual, software-keyboard, small-phone, VoiceOver, Reduce Transparency, Android-resize or physical-haptic pass is claimed. Native build success and mocked tests do not establish those behaviors.

Latest refinement: the direct Brand workflow passes its workspace and brand-sheet regression tests; the earlier nine-suite result above describes the preceding full refinement run.
