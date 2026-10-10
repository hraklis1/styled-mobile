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
