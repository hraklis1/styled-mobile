# LLM optimization implementation status

October 8, 2026. Implementation is in the sibling `../Styled` backend, directly on `main`. Existing uncommitted work was preserved. This report distinguishes previously present functionality from changes made during this implementation pass.

## Current route inventory

| Route or task | Assembly and model routing | Existing controls | Result of verification |
|---|---|---|---|
| Stylist classifier | `routes.ts`; `stylist_classifier` | Deterministic routing before ambiguous classifier calls | Parent interaction attribution added |
| Closet outfit | `buildClosetPromptParts`; light/complex | Readiness checks, balanced candidates, structured slots, one correction, 30-minute exact cache | Final identity refined; display assets excluded from validation identity |
| Pairing/advice and board direction | `buildAdvicePromptParts`; light | Smaller candidate pool and referenced context | Parent interaction attribution added; explanation budgets unchanged |
| Generic knowledge | `buildKnowledgePromptParts`; knowledge | Wardrobe-free prompt; standalone shared cache; seven-day TTL | Effective request identity and distributed deduplication added |
| Trips/board capsules | `buildTripPromptParts`; premium | Aggregate context and representatives; bounded retry and per-look validation | Correction attempt attribution added; output budgets unchanged |
| Wardrobe audit | Dedicated audit facts/prompt | Bounded aggregate facts; owned-ID sanitization | Parent interaction attribution added |
| Shopping copy | Dedicated shopping prompts/routes | Structured outputs; current task-specific caps | Parent interaction attribution added when triggered by stylist ask |
| Retrieval | Existing embedding wrapper and query cache | Exact input/model/dimensions key; bounded category selection | Independent query-cache rollback restored; unavailable embedding usage stays unknown |
| Conversation summary | Summary route; `memory.ts` | Six-message incremental blocks and predecessor reuse | Conversation isolation, oversized turns, and recovery hardened; unavailable rolling state fails safely |
| Vision and other LLM execution | Provider adapters and `llm/index.ts` | Existing task resolution and normalized usage | Missing usage and stream failures recorded; full text-prompt footprint measured; optional total budget checked before provider execution |
| Attribute batch backfill | `scripts/batch-stylist-attributes.ts` | Opt-in submission/collection, stale-input protection, transactional collection markers | Existing functionality retained; no jobs submitted |

## Changes delivered

- Request-scoped interaction IDs connect classifier, retrieval, summaries, generation, corrections, and deferred calls made within stylist ask. Other standalone endpoints retain individual call accounting; extending interaction outcomes to them is follow-up work.
- One terminal stylist-request event distinguishes successful delivery, incomplete looks, clarification, HTTP/SSE errors, and aborted connections. Delivery success is not a user-quality score.
- Stream setup, iteration, cancellation, and final-result failures are observed once. Successful finalization is memoized, preventing duplicate ledger entries.
- Missing provider usage remains an unknown cost. The existing spend report exposes this gap and accounts for cache-write duration when pricing historical uncosted rows.
- A new read-only interaction report aggregates known spend, shared cache storage, successful deliveries, failures, correction counts, response-cache hit rate, and latency percentiles. It now excludes unrelated standalone vision calls from stylist interaction totals, separates unallocated expenses from attributed costs, and reports input/output/ceiling distributions and truncations by task, provider, and model. Missing usage stays unknown; estimates are reported separately from provider token counts.
- Final outfit cache identity uses the actual request plus relevant validation attributes, rather than entire garment records containing photos and timestamps.
- Standalone knowledge requests use the same effective-request hashing and duplicate-request leases. Cacheable knowledge answers are buffered before emission; conversation-specific answers retain streaming behavior. Truncated standalone answers are rejected instead of cached.
- Cache storage outages fall back to one validated computation per caller, with an observable warning. Shared deduplication is unavailable during an outage, so duplicate spend remains possible.
- Query embeddings, response caching, summary caching, and shared provider-cache metadata no longer all depend on the response-cache rollback switch.
- Gemini cache handles now use the provider-reported expiry, with the existing one-minute safety margin. Missing expiry falls back conservatively to creation-start time; malformed or near-expired handles are never used. This follows the authoritative `expireTime` field in the [Google caching API reference](https://ai.google.dev/api/caching). A delayed eviction failure removes only its own local handle, preserving a newer replacement; schema, quota, and general permission errors no longer trigger an inline generation replay merely because they mention cached content.
- Cache publication uses a transaction that holds the lease row lock, writes the result, then rechecks expiry after any database wait. Expired writes are rolled back before becoming visible. Acquisition starts the new lease lifetime after a lock wait, and renewal cannot revive a lease that expired while waiting. Lease timestamps explicitly use UTC to match the existing timestamp-without-time-zone schema and Drizzle's Date serialization. Tests exercise PostgreSQL's [row-lock recheck behavior](https://www.postgresql.org/docs/current/transaction-iso.html), including conflicts that roll back.
- Conversation summary keys include conversation identity. Oversized turns cannot bypass the recent-history budget. A failed summary returns a recoverable error rather than silently dropping expired constraints; summaries are no longer arbitrarily cut midway through a fact.
- A failed summary-state write does not discard safely recovered notes. Unavailable persisted state still fails closed because a rolling history window may omit earlier constraints. Requests without persisted state can rebuild notes from supplied history when cache reads fail.
- Disconnected requests cancel cache waiters before a second paid computation starts. An already-running owner can finish and publish its validated result for other callers.
- Every LLM attempt records estimated static, stable-user, request-context, message, schema, and framing tokens, plus the effective output reserve. An optional total budget rejects oversized requests before making a provider call, with known zero spend. Existing model routes and output ceilings remain unchanged.

## Phase status and remaining gates

| Phase | Local status | Remaining work before claiming its full acceptance gate |
|---|---|---|
| 0 — Inventory | Current entry points and existing changes inspected | Inspect deployed overrides and production usage separately |
| 1 — Accounting | Stylist attribution, failure recording, scoped cost report, and task/token distributions implemented; report query verified against PostgreSQL fixtures | Collect representative baseline; reconcile provider invoices; extend terminal outcomes to other interaction endpoints if needed |
| 2 — Selection/identity | Existing balanced selection retained and tested; cache boundary refined | Validate captured product fixtures and user outcomes; broader changes to unknown-attribute eligibility or aesthetic validation require separate quality review |
| 3 — Duplicate work | Deduplication, recovery, cancellation, and publication fencing verified against real PostgreSQL, including separate server processes | Introduce early application keys only after complete mutation/revision coverage exists; observe database latency during rollout |
| 4 — Provider prefixes | Layered prompts and Gemini sharing retained; independent control repaired; provider expiry and replacement recovery verified with SDK stubs | Measure actual provider prefix reuse and storage economics; inspect deployed configuration |
| 5 — Memory | Incremental memory safeguards, isolation, prompt-section measurements, and optional total text/output budget implemented | Validate representative long conversations and choose task budgets from measured traffic; image-token estimates remain unavailable |
| 6 — Output/batching | Existing ceilings and opt-in attribute batch retained | Tune ceilings from output/truncation distributions; assess other batch jobs and pre-generation consumption before implementation/activation |

An early application cache was deliberately not introduced: the current route does not establish comprehensive wardrobe/profile/conversation revisions covering every mutation. The final exact cache remains the correctness boundary.

No budget reductions, additional scheduled jobs, cheaper models, frontier escalation, personalized semantic response cache, Redis service, or vector index were introduced. These decisions follow the plan's measurement and quality gates.

## Verification

- Before changes: 26 targeted optimization/pricing/dealbreaker tests passed.
- After the database continuation: all 343 tests in the backend, LLM, vision, and commerce suite passed with PostgreSQL integration enabled.
- After the Gemini lifecycle continuation: 339 tests passed, with the opt-in PostgreSQL suite skipped because its temporary server was stopped. Six new SDK-stub tests cover concurrent creation, private-context separation, provider expiry, delayed eviction versus a replacement, non-eviction errors, creation recovery, and malformed expiry. The database implementation was unchanged in this continuation.
- The database suite covers separate callers and server processes, takeover, owner-checked release/renewal, delayed acquisition, delayed renewal, expiry during blocked updates and inserts, repeatable metadata migration, and the real report query. Sessions deliberately use a non-UTC timezone.
- Backend/client TypeScript checks passed with incremental cache writing disabled. Both spend-report scripts also passed separate strict TypeScript checks.
- The production build passed. Existing build notices concerned browser compatibility data and bundle size.
- Execution-accounting tests used mocked providers and storage. No paid calls, batch submissions, application/production database writes or migrations, commits, or pushes were performed.
- PostgreSQL ran as a disposable loopback-only test cluster using temporary [embedded-postgres binaries](https://github.com/leinelissen/embedded-postgres). Only synthetic test data and test tables were created. The temporary server was stopped after verification; no system database service or project dependency was installed.

## Release prerequisites and baseline collection

The existing additive migration `../Styled/migrations/0064_llm_optimization_metadata.sql` must be applied through the backend's approved migration workflow before deploying code that writes or queries metadata. It was already present and remains unapplied by this task. Do not use `db:push`.

After the migration and staged rollout, run the read-only report from the backend repository:

```sh
npx tsx --env-file=.env scripts/show-llm-interactions.ts --from YYYY-MM-DD --to YYYY-MM-DD
```

Dates are inclusive UTC days. Run the existing spend report alongside it for costs outside attributed stylist interactions. Do not interpret a delivery count as a usefulness rating, and do not claim savings until enough representative traffic exists.

Existing rollback settings are `LLM_OPTIMIZATIONS`, `LLM_RESPONSE_CACHE`, `LLM_QUERY_EMBEDDINGS`, `LLM_BOUNDED_RETRIEVAL`, `LLM_BOUNDED_MEMORY`, `LLM_SHARED_PROVIDER_CACHE`, and `LLM_PROMPT_BUDGET`; setting a switch to `false` disables that optimization. Test a small cohort before wider release. Retain model routes and output ceilings while measuring cost, latency, corrections, incomplete looks, rejection/swap outcomes, and cache reuse.

Total-budget enforcement is off until a limit is configured. Set `LLM_TOTAL_TOKEN_BUDGET` for a global estimated text-input-plus-output-reserve limit, or a task override such as `LLM_TOTAL_TOKEN_BUDGET_STYLIST_LIGHT`, `LLM_TOTAL_TOKEN_BUDGET_STYLIST_KNOWLEDGE`, or `LLM_TOTAL_TOKEN_BUDGET_STYLIST_PREMIUM`. Values must be positive integers. Choose them from the report's task distributions rather than adopting an arbitrary default. `LLM_PROMPT_BUDGET=false` disables enforcement while retaining measurements, including when a disabled budget setting is malformed.

These footprint values are UTF-8 byte-based estimates, not tokenizer results or billing figures. Image data is never counted as text; image-token usage is explicitly unknown before the provider response. The optional guard therefore bounds the estimated text portion and output reserve, not a complete multimodal context window.

To reproduce database verification, provide a dedicated loopback PostgreSQL database named `styled_llm_test` (or `styled_llm_test_<suffix>`), then run from the backend:

```sh
LLM_CACHE_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/styled_llm_test \
  node --import tsx --test server/llm/cache.postgres.test.ts
```

The suite creates and drops synthetic tables in that dedicated database and refuses other hosts/database names. Without this environment variable, regular test runs skip the database integration suite.

Local changes are ready for review. Production gates and measurement-dependent phases remain open.
