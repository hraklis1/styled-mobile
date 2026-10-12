# Continuing client relationship: chat candidate

Implemented 12 October 2026 across Styled-mobile and the sibling Styled backend. The continuing-client stylist is active by default for all capable clients, following the user’s activation preference. Daily Look and standalone shopping retain their existing implementations. No model change was made.

## Context and memory

The existing canonical context builder now supplies the new conversational core with saved profile constraints, observed wear/feedback evidence, relevant wardrobe detail, and the current consultation. A separate persistent memory service records explicit conversational preferences and tentative learned preferences, with source message IDs, source quotations, confidence, scope, and dates. Current consultation state travels with the saved answer rather than becoming a durable preference.

New proposals must cite text in the actual latest user message. Temporary proposals are not saved as durable memories. Model-authored suggestions are not accepted as user evidence. Row-locked updates prevent concurrent requests from overwriting each other's memory changes. Corrections become explicit facts; forgetting suppresses both the old key and supporting evidence. History summaries are rebuilt under the memory revision and exclude forgotten source messages and old assistant paraphrases.

Existing saved profile fields remain explicit facts in the canonical profile, editable through their existing settings screens. Existing generated fingerprints and style tags are seeded once as provisional impressions with unknown historical dates. They are excluded from the candidate's old parallel fingerprint channel. There is no invented backfill timestamp.

Settings → Stylist → **What your stylist knows** exposes saved profile sections and editable/forgettable memories. Failed corrections keep the draft and show a retryable error. Legacy accounts outside the rollout continue to see the existing learned-style screen.

Backend additions: `shared/stylistClient.ts`, `server/stylistClientMemory.ts`, `server/stylistClientStore.ts`, and `server/stylistClientRoutes.ts`. Authenticated endpoints:

- `GET /api/stylist/client-memory`
- `PATCH /api/stylist/client-memory/:id` with `{ "statement": "…" }`
- `DELETE /api/stylist/client-memory/:id`

Migration `0067_stylist_client_memory.sql` creates the additive, user-owned memory table. Applied to the local development database. Account isolation, anonymous rejection, concurrent learning, persisted corrections, forgetting, and suppression are exercised by `scripts/check-stylist-client-store.ts` with disposable accounts.

## Reasoning and evidence

`server/stylistClientPrompt.ts` defines the trusted-adviser behavior. The current prompt version is `client-relationship-v4.4`. One conversational loop chooses evidence tools without a new fixed intent router. Simple advice can finish in one call. Complex requests can inspect multiple garment roles and compare directions. The candidate does not seed an arbitrary wardrobe subset and will not declare an anchor-only foundation while available essential roles remain unexplored.

Product retrieval carries saved category budgets, preferred retailers, brand exclusions, currency, country, and category size. A saved size is search context, not proof of retailer stock or fit; uncertain size availability and fit remain unverified. No live-retailer acceptance test has been completed in this change.

Default bounds are 45 seconds, 6 generation rounds, 12 tool executions, 96 detailed items, 18,000 estimated text input tokens, and 3,000 output tokens per generation. One bounded repair may follow. Repeated searches that make no progress stop. A deadline interrupts the response even if a read-only provider adapter cannot cancel its underlying work. The final wardrobe refresh must succeed before a grounded outfit is published.

`STYLIST_CLIENT_MAX_USD` defaults to $0.40 and guards generation reservations using repository pricing and returned usage. This is **not a hard cap on total endpoint billing**: retrieval embeddings, conversation summaries, commerce providers, and optional audio remain under existing infrastructure and accounting. Multimodal input estimates are conservative allowances, not invoice guarantees.

## Delivery

The internal model contract is version 4. The compatible transport remains response version 3 with optional versioned editorial metadata and a new standalone checklist payload. Ordered blocks reuse existing prose, wardrobe looks, commerce selections, and comparison components. Checklist presentation no longer requires a complete outfit. Origin labels distinguish wardrobe selections, shopping, and conceptual directions. Relevant refinement controls submit another conversational request; saving outfits, buying, and editing events remain explicit user actions.

The server validates and persists the complete answer before publishing its ordered SSE units and completion event. Reopening reconstructs the same payload through existing history adapters. This implementation preserves buffered model generation: it does **not** claim token-by-token streaming or an early first card while the model is still deciding. Published content remains restorable if delivery disconnects after persistence.

Candidate-specific presentation checks do not change legacy v3 validation. Historical messages without editorial metadata retain their existing render paths.

## Rollout and rollback

Mobile capability `stylist_client_v4` selects the new experience. Runtime defaults and `.env.example` enable it for 100% of capable clients; the local backend configuration also enables every account. Explicit server flags remain available for rollback. The user requested that completed changes be active by default; human quality review continues as evaluation work rather than an activation prerequisite. Hosted production was not deployed in this session.

Configuration: `STYLIST_CLIENT_ENABLED`, `STYLIST_CLIENT_PERCENT`, `STYLIST_CLIENT_USER_IDS`, `STYLIST_CLIENT_TIMEOUT_MS`, `STYLIST_CLIENT_MAX_USD`, `STYLIST_CLIENT_MAX_CALLS`, `STYLIST_CLIENT_MAX_TOOLS`, `STYLIST_CLIENT_MAX_ITEMS`, and `STYLIST_CLIENT_INPUT_TOKENS`.

Rollback is setting `STYLIST_CLIENT_ENABLED=false` and restarting the server. Keep the additive table and saved responses so memory and historical content are not lost. Deployment requires applying the migration before enabling the flag.

## Verification and quality evidence

- Before replacement: 57 focused backend tests passed against the existing implementation.
- Final checks: backend typecheck and 85 focused tests pass; mobile typecheck, lint, and all 144 suites / 1,073 tests pass. Both repositories pass whitespace/diff checks.
- Database/HTTP integration checks pass with disposable accounts.
- Native iOS build succeeded. The simulator showed the memory screen and delivered a real wardrobe-based lunch recommendation with its refinement action. After the Mac was unlocked, reopening that conversation restored its imagery, rationale, and refinement action. A new hypothetical three-day Miami request returned an eight-entry conceptual packing checklist respecting the trip-only wool exclusion. The checklist rendered cleanly, all entries were reachable by scrolling, and reopening it from history restored the same content. No outfit was saved, wear logged, purchase made, or event changed during these checks.
- `scripts/eval-stylist-client.ts` compares baseline and candidate on the same configured model using synthetic wardrobes and the real generation/tool loop. It does not exercise endpoint persistence, live retailer results, photo/audio input, or every long-conversation scenario.

The 12-case v4.3 comparison produced 11 complete responses and one honest shopping partial on each side. Candidate median elapsed time was 4,574 ms versus 3,818 ms; estimated generation cost was $0.0738612 versus $0.04729005 for all 12 responses. That is approximately 1.56× baseline cost, so it does not establish a cost improvement or satisfy a 1.5× cost gate. These small samples are not statistically conclusive.

Earlier pilots exposed premature anchor-only foundations, inappropriate outfit cards for buying advice, and inability to express packing advice without a full look. Those findings drove changes. The final v4.4 two-case regression run returned a standalone Miami checklist and concise advice to skip a duplicate navy shirt; both completed, and the trip-only wool exclusion created no durable memory. Candidate cost for those two responses was $0.0097812 versus $0.00516615 baseline. Delivery success is recorded separately from recommendation quality.

Blind review packets are in `docs/stylist-client-review/`. Rate each answer before opening the matching reviewer key. All human ratings remain null. The acceptance packet reflects v4.3; the delivery packet reflects v4.4 and must not be represented as a new 12-case run. Synthetic fixture profiles and wardrobe details live in the backend evaluation script.

Remaining evaluation work: complete blind human quality review; verify live commerce constraints and unavailable evidence; exercise photo critique, topic changes, corrections and temporary exceptions over long conversations; finish interrupted-connection recovery and comprehensive accessibility checks (including large text and VoiceOver). Expand to Daily Look or standalone shopping only after those checks and comparative recommendation quality support it.

The implementation spans Styled-mobile and the sibling Styled backend. Local environment files remain ignored; checked-in defaults enable the new stylist for capable clients.
