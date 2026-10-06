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
  askStylist: 'Would this work with my wardrobe?',
  captureInformation: 'Capture information',
  tagDetails: 'Tag details',
  considering: 'Considering',
  wishlist: 'Wishlist',
  inCloset: 'In closet',
  passed: 'Passed',
  allPieces: 'All pieces',
  showPieces: 'Show pieces',
  separatePhotos: 'Separate photos',
  /** Deletes every photo of one piece, from the organizer's piece menu. */
  removePiece: 'Remove piece',
  removePhoto: 'Remove photo',
  renamePiece: 'Rename',
  namePiece: 'Name this piece',
  /** The organizer's non-gesture regroup: pick the piece a photo goes to. */
  moveTo: 'Move to…',
  newPiece: 'New piece',
  markAsTag: 'Mark as tag',
  markAsGarment: 'Mark as garment',
  selectPhotos: 'Select',
  /** Visit title before a store is given; the store is asked for by a chip. */
  todaysVisit: "Today's visit",
  /** Captured on the device, not uploaded yet. Never "pending" or "sync". */
  onThisPhone: 'On this phone',
  /** Uploaded. Only appears in the item lightbox. */
  backedUp: 'Backed up',

  /** The state: this find has no store attached. */
  needsStore: 'Store not added',
  /** The action that resolves it. */
  addStore: 'Add store',

  /** The state: no price was read off the tag. */
  needsPrice: 'Add price',
  /** A price was read but more than one candidate came out of the tag. */
  confirmPrice: 'Confirm price',
  /** A piece with neither a product name nor a category. */
  untitledPiece: 'Untitled find',

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
