/**
 * One word per state, for the whole shopping surface.
 *
 * The shortlist used to call a single state four things — "waiting to sync",
 * "Pending", "On this device", "saved locally" — often within one screenful.
 * Every user-facing string for these states now comes from here.
 *
 * IMPORTANT: none of these are data keys. `reviewReasons` on a ShoppingEditItem
 * are English strings used as identifiers (see itemReviewReasons in
 * ./shoppingGallery), and the group key in ./shoppingSessionGroups embeds
 * 'Store not set' verbatim. Those literals must never be rewired to this table.
 */
export const SHORTLIST_COPY = {
  piece: 'piece',
  pieces: 'pieces',
  visit: 'visit',
  visits: 'visits',
  photos: 'photos',
  editDetails: 'Edit details',
  askStylist: 'Ask the stylist about this',
  captureInformation: 'Capture information',
  tagDetails: 'Tag details',
  considering: 'Considering',
  wishlist: 'Wishlist',
  inCloset: 'In closet',
  passed: 'Passed',
  allPieces: 'All pieces',
  showPieces: 'Show pieces',
  separatePhotos: 'Separate photos',
  /** Captured on the device, not uploaded yet. Never "pending" or "sync". */
  onThisPhone: 'On this phone',
  /** Uploaded. Only appears in the item lightbox. */
  backedUp: 'Backed up',

  /** The state: this find has no store attached. */
  needsStore: 'Needs store',
  /** The action that resolves it. */
  addStore: 'Add store',

  /** The state: no price was read off the tag. */
  needsPrice: 'Needs price',

  /** The state: a photo the classifier never filed as garment or tag. */
  unsorted: 'Unsorted',
  /** The action that resolves it. */
  sortPhotos: 'Sort photos',

  /** Tag text was read but no price came out of it. */
  checkTagText: 'Check tag text',

  /** Nothing outstanding, on one item. */
  settled: 'Settled',
  /** Nothing outstanding, across a whole visit. */
  allSettled: 'All settled',
} as const;
