# Curated shopping implementation

Four placements share CuratedItemCard and CuratedItemRail: the focused Shop wardrobe edit, expanded priority guides, explicit Stylist shopping responses, and Daily Look missing pieces after shopping intent. Complete owned looks stay wardrobe-focused.

Editorial responses return independently of commerce. The authenticated premium `/api/shop/offers` endpoint resolves server-owned references or owned wishlist records. Mobile fetches products separately, suspends when inactive, and polls only pending targets. Target states distinguish pending, ready, empty, unavailable and disabled; expiry follows the commerce cache instead of the editorial guide cache.

Exact product saving uses a server-verified offer and stable user/provider/product identity. Saved products retain their original URL, identity and dated price; refresh updates only matching identities and shows alternatives separately. Existing piece/look/list entries and guide saves remain supported. Hotlink thumbnails use memory caching; inline image bytes are stripped from durable caches and saves, and hotlink product images are excluded from generated permanent board covers.

Configured budget tolerance applies to suggested bands; explicit maximums are hard ceilings. Explicit category/attribute mismatches and known unavailable products are filtered. Unknown stock, fit and currency stay unknown. Aggregator destinations say View listing.

Validation: mobile typecheck, lint, Jest; backend typecheck and commerce regression tests; iOS native build and visual checks of the Daily Look reveal and priority guide. Live Serper evaluation of three Canadian targets returned 120 candidates and 13 qualified results, but only one target met the coverage threshold (33.3% versus 80%). This small sample is a quality limitation, not a coverage guarantee. Broader market evaluation and VoiceOver/large-text/device checks remain release QA work.

Run `npm run eval:commerce:serper` with backend Serper configuration available to evaluate retrieval. Reports contain metadata and URLs, never inline image bytes. Backend `.env.example` documents activation.

## Premium product presentation

Shared cards use contained 4:5 imagery, independent over-image bookmark controls, conservative display-title/merchant cleanup, and unchanged original offer data. Preview rails show three eligible offers at 64% of measured content width (maximum 280 points, with a 160-point minimum when space permits), with snapping. Explore all options opens a shared full-screen browser showing every supplied eligible offer in original order; the grid uses one column for narrow layouts or enlarged text. Saving, retry feedback, disclosures, and original offer positions in analytics are shared between preview and browser.

Daily-look suggestions lead with the garment headline and existing recommendation reason. Rejection feedback sits beside that explanation; shopping previews precede supporting wardrobe details. The footer opens the first available target's collection, with additional targets retaining their own collection action, and Read styling notes opens the existing guide. No-buy, empty, and unavailable results do not expose an empty collection. Saved-product details retain their original link and dated price alongside a full-width image.

## Focused Shop edit and product details

Shop presents one ranked wardrobe priority at a time, with a compact selector and the existing not-now feedback queue and undo window. Only the selected priority is requested. The first style direction with eligible listings provides the three-product preview; empty and disabled commerce leaves the guide, brief, shortlist, and saved destinations usable. Rationale sits once above the collection.

Priority-edit requests accept `purpose: preview | guide` (default `guide`). Previews do not record an explicit guide open. The client separates purpose-specific queries so a cached preview cannot suppress a guide request; both requests reuse the same server editorial cache. No-buy updates write only to the dated brief query, preserving priority-edit caches.

Product cards open the shared product-detail view. Details contain product information, independent save/unsave controls, an explicit retailer action, and available style rationale and owned-piece outfit ideas. Pairing guidance refers to the suggested style, without claiming verified fit for the exact listing. Collection details render within the existing browser modal, preserving the underlying collection and scroll position; closing or Android Back returns to that collection. Product-detail views and retailer clicks are separate analytics events. Saved products reuse the same detail content while retaining their original URL, exact identity, and dated price.
