# Conversational AI stylist v2

Implemented October 10, 2026. **The conversational stylist is enabled by default for supported clients.** Explicit backend rollout overrides still apply.

## Behavior

The mobile chat advertises `stylist_blocks_v2`. The backend selects the new path only for a capable client in the configured stable user cohort. All other requests use the existing stylist. Daily Look and standalone shopping services remain on their existing paths.

The new path uses the existing `stylist_flagship` model route and one shared stylist prompt. It can answer immediately or request read-only evidence: owned pieces, boards, saved looks, wear statistics, weather, and actual products. There is no intent-classifier or separate planning call. OpenAI is the first supported tool adapter; configuring another provider keeps requests on the legacy path. Existing swap signals and the daily taste-fingerprint refresh cadence are preserved, with deferred LLM costs attributed to their parent interaction.

Discovery includes out-of-season and unavailable pieces. Discussion and comparison can reference them; complete looks must pass existing ownership, availability, composition, occasion and weather validation. Explicit weather constraints are retained over retrieved conditions. Missing wear logs remain unknown. Product search requires explicit shopping intent or acceptance of a product-search offer; a purchase decision can recommend buying nothing.

Replies contain ordered text and optional cards. Existing outfit, trip, audit, clarification, wishlist and event actions are reused. Each card retains independent saved/edit state. Validated blocks are emitted over SSE after generation/validation, followed by an authoritative `done` event. They are persisted in order and restored as a single conversation turn. This version buffers model output before publishing blocks; it does not expose unvalidated token-by-token output. Interrupted streams show an error and retain any validated blocks already received.

## Limits and caching

- Two tool-request rounds, six tool executions and three normal generation calls maximum. One validation repair is the absolute fourth generation call; both wrapper and OpenAI SDK retries are disabled for these calls.
- Thirty search results per execution and sixty distinct detailed owned pieces per turn, including attached/referenced pieces. References that cannot be inspected remain explicitly unresolved in the prompt.
- Twelve thousand estimated text input tokens per call and an absolute 2,500-token output ceiling. Under pressure, retrieved tool results are compacted while retaining useful item facts and marking partial evidence; user turns, preferences and memory are never silently truncated. Requests that still exceed capacity receive a useful narrowing message without a paid generation call.
- Images are not counted as text; image billing remains separately measured by provider usage. The text ceiling is not a total multimodal token guarantee.
- Existing conversation-summary caching and query-embedding reuse remain active. Exact completion caching/deduplication is user-scoped and includes current wardrobe/profile revisions, model, prompt, schema, tool definitions, tool results and validation version. Invalid/truncated completions are not cached. Dynamic tools still run against current data before a cached final completion can be reused.
- All generation attempts, embeddings, summaries, corrections and deferred calls retain the existing parent interaction accounting. Degraded evidence fallbacks are marked failed; successful delivery is not a usefulness score.

## Enablement and rollback

The backend defaults to enabled with a 100% cohort. The deployment configuration and environment example explicitly set:

```dotenv
STYLIST_V2_ENABLED=true
STYLIST_V2_PERCENT=100
```

Restart the local backend to pick up code changes; production requires deploying the updated backend. Existing environment overrides take precedence. Set these **backend** environment variables to restrict access to internal testing:

```dotenv
STYLIST_V2_ENABLED=true
STYLIST_V2_USER_IDS=123,456
STYLIST_V2_PERCENT=0
```

Replace the example IDs with internal users. The allowlist is subject to the master switch and client capability check. Leave `STYLIST_FLAGSHIP_*` unset to use the current production default, or use its existing OpenAI model override. No model-price assumptions were added.

Set `STYLIST_V2_PERCENT=10` for a stable 10% cohort if a staged rollout is desired. Review matched traffic quality, known average interaction spend and p95 latency; the paid comparisons and blind review remain pending. The code exposes the cohort controls; it does not autonomously change rollout percentage. Set `STYLIST_V2_ENABLED=false` for immediate rollback. Stored v2 messages remain readable by the updated mobile client after rollback.

## Evaluation

The sibling backend contains sixty fixed scenarios in `scripts/stylistConversationScenarios.ts`: ten categories and four fixture profiles, including a sparse profile, a large closet, cold-weather needs, photo inputs and follow-ups. `scripts/eval-stylist-conversation.ts` captures both actual `/api/stylist/ask` paths, randomizes A/B assignment/order, prepares blind review files, and queries the existing usage ledger read-only for scoring.

From the backend, validate the free manifest:

```sh
node --import tsx scripts/eval-stylist-conversation.ts --check
```

For a paid comparison, prepare dedicated premium fixture users: `standard`, `sparse`, `large`, and `cold`. Sparse should have little profile data and no wear history; large should have at least 200 garments; cold should include warm and rain-ready pieces. Include unavailable/repair items, saved looks and board inspiration. Configure their IDs in the internal rollout allowlist. Use real labelled photos appropriate to each account. Keep fixture profiles and wardrobe data stable during capture, including a recently refreshed taste fingerprint so background learning does not change a pair's personal context. Reviewers need the fixture wardrobes and explicit preferences to judge grounding; the harness does not create or alter those fixtures.

Create a private accounts JSON outside either repository. Each profile maps to:

```json
{
  "tokenEnv": "STYLIST_EVAL_STANDARD_TOKEN",
  "selectedItemIds": [1, 2],
  "boardId": 3,
  "photoFile": "/absolute/path/to/labelled-fixture.jpg",
  "weatherSummary": "Rainy 2°C",
  "location": "Toronto, Canada"
}
```

Provide bearer tokens through those environment variables, not the JSON file. Photo fixtures must be JPEGs. Account IDs and selected pieces must belong to the corresponding fixture user. Each capture sends 120 paid requests and creates test conversation history through the normal endpoint; it must run against fixture accounts, not production customers.

```sh
node --import tsx scripts/eval-stylist-conversation.ts --capture --accounts /private/tmp/stylist-accounts.json --api-url http://localhost:5000 --out /private/tmp/stylist-evaluation
```

Give reviewers `blind-review.json` and `ratings-template.json`; keep `private-key.json` private until review is complete. For each side, rate relevance, personalization, grounding and usefulness from 1–5 (1: fails the request; 3: useful with material weaknesses; 5: specific, grounded and fully useful). Choose an overall winner `A`, `B` or `tie`; count ownership violations and invalid complete-look claims on each side. Set `coreOutfitWorse` to `A`, `B`, or `neither` for a regression in a core outfit workflow. Review validity in both prose and cards. Do not treat successful HTTP delivery as quality.

After background accounting has settled, score against the same server's database:

```sh
node --import tsx scripts/eval-stylist-conversation.ts --score --out /private/tmp/stylist-evaluation --ratings /private/tmp/stylist-evaluation/ratings.json
```

The score requires all 60 reviews, zero candidate ownership violations or invalid complete looks, no candidate core-outfit regression, at least 60% candidate wins among non-ties, average known cost no higher than 1.5× baseline, and p95 latency no higher than 1.5× baseline. Unknown usage/cost and failed candidate interactions block a pass. Reconcile any unallocated shared provider-cache storage separately before making rollout decisions. Repeat captures on representative traffic; a small fixed suite alone cannot establish production cost or usefulness.

The paid comparison and blind human review have **not** been run as part of this implementation. No quality improvement or production savings are claimed.

## Conversation quality follow-up (October 10, 2026)

The backend now defaults v2 on for capable clients; the earlier rollout-off description above records the original implementation. Rollout overrides still apply.

Version `conversation-v2.3` removes the keyword-based product-tool gate: the shared prompt asks the model to infer whether new recommendations or product search serve the conversation, respect closet-only requests, and distinguish general model advice from verified listings. Product cards still require retrieved offer IDs. No classifier or extra planning call was added.

Prose validation no longer uses the fuzzy wardrobe retrieval matcher, which could associate generic garment descriptions with unrelated owned pieces. Exact named references still require inspection. Invalid shopping cards preserve valid general advice. Failed repairs log validation reasons and distinguish shopping, outfit, and malformed-response limitations. Outfit completeness claims accompanying failed looks remain withheld. Live diagnostics also identified the legacy inferred smart-casual per-item floor as the dinner failure: v2 now allows model judgment for inferred smart-casual combinations and subjective pattern/texture composition. Explicit event dress codes and formal occasion rules, structural completeness, availability, ownership, dealbreakers, and weather checks remain enforced. Legacy callers retain their original validators.

Optional model-written follow-ups replace static mode-based suggestions for v2, including no suggestions when none are useful. Conversation prose uses body typography; referenced wardrobe thumbnails have labels and more space. Single-offer v2 products use compact image/name/merchant/price rows, retaining wishlist saving and purchase links. Existing composer/dictation edits were preserved.

Regression coverage includes product search without buy keywords, generic garment descriptions, invalid shopping cards, failure messaging, and optional follow-ups. The fixed 60-scenario review manifest now includes the reported shoe requests. Automated checks do not establish live model quality; a paid blind evaluation remains outstanding. Live simulator checks confirmed shopping returns verified listings and compact rows; the dinner replay exposed premature shoe-only foundations, so prompt guidance now explicitly asks for missing-category retrieval and one footwear choice. Mixed owned/purchase outfit saving and the broader product-versus-retailer redesign are not part of this patch.

### Approved initial wardrobe sample

Version `conversation-v2.4` adds up to twelve available, non-archived, owned pieces alongside explicitly referenced items. The user explicitly approved this additional model context. The sample takes at most two additional pieces per category, makes one pass across categories before adding second pieces, and shares the existing sixty-item inspection ceiling. Referenced pieces take priority. The prompt labels the sample nonexhaustive and allows the model to retrieve other pieces; it does not prescribe an outfit or response pathway. Tests cover cross-category evidence, the twelve-item bound, ownership/availability filtering, deduplication, and the shared inspection ceiling.

The approved sample passed 51 backend regression tests and the backend type check. A live replay in the existing conversation used a wardrobe suit jacket alongside the running shoe, but still returned a foundation instead of a complete outfit. The added context is not a claim that the dinner flow's live quality is resolved.

### Editorial v3 candidate (October 11, 2026)

The opt-in editorial successor is documented in [ai-stylist-v3.md](ai-stylist-v3.md). V2 remains the default. The evaluation manifest now has 72 cases and compares v2 against v3; a full capture makes 144 paid fixture requests. Candidate rollout requires the expanded editorial/task-completion rubric as well as the existing grounding, cost and latency gates. No paid comparison or production rollout has been performed.
