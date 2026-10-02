# Curated shopping implementation

Three placements share CuratedItemCard and CuratedItemRail: expanded priority guides, explicit Stylist shopping responses, and Daily Look missing pieces after shopping intent. Complete owned looks stay wardrobe-focused.

Editorial responses return independently of commerce. The authenticated premium `/api/shop/offers` endpoint resolves server-owned references or owned wishlist records. Mobile fetches products separately, suspends when inactive, and polls only pending targets. Target states distinguish pending, ready, empty, unavailable and disabled; expiry follows the commerce cache instead of the editorial guide cache.

Exact product saving uses a server-verified offer and stable user/provider/product identity. Saved products retain their original URL, identity and dated price; refresh updates only matching identities and shows alternatives separately. Existing piece/look/list entries and guide saves remain supported. Hotlink thumbnails use memory caching; inline image bytes are stripped from durable caches and saves, and hotlink product images are excluded from generated permanent board covers.

Configured budget tolerance applies to suggested bands; explicit maximums are hard ceilings. Explicit category/attribute mismatches and known unavailable products are filtered. Unknown stock, fit and currency stay unknown. Aggregator destinations say View listing.

Validation: mobile typecheck, lint, Jest; backend typecheck and commerce regression tests; iOS native build and visual checks of the Daily Look reveal and priority guide. Live Serper evaluation of three Canadian targets returned 120 candidates and 13 qualified results, but only one target met the coverage threshold (33.3% versus 80%). This small sample is a quality limitation, not a coverage guarantee. Broader market evaluation and VoiceOver/large-text/device checks remain release QA work.

Run `npm run eval:commerce:serper` with backend Serper configuration available to evaluate retrieval. Reports contain metadata and URLs, never inline image bytes. Backend `.env.example` documents activation.

## Premium product presentation

Shared cards use contained 4:5 imagery, independent over-image bookmark controls, conservative display-title/merchant cleanup, and unchanged original offer data. Preview rails show three eligible offers at 78% of measured content width (maximum 320 points), with snapping and a position indicator. Explore all options opens a shared full-screen browser showing every supplied eligible offer in original order; the grid uses one column for narrow layouts or enlarged text. Saving, retry feedback, disclosures, and original offer positions in analytics are shared between preview and browser.

Daily-look suggestions lead with the garment headline and existing recommendation reason. Rejection feedback sits beside that explanation; shopping previews precede supporting wardrobe details. The footer opens the first available target's collection, with additional targets retaining their own collection action, and Read styling notes opens the existing guide. No-buy, empty, and unavailable results do not expose an empty collection. Saved-product details retain their original link and dated price alongside a full-width image.
